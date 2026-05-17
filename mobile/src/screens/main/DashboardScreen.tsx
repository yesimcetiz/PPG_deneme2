/**
 * DashboardScreen.tsx — Scenario B
 * ESP32'den gelen işlenmiş stres sonucunu gösterir.
 * Ham PPG grafiği yok — sadece stres skoru, HR, HRV ve bağlantı durumu.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp, useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { usePpgStore, StressLevel, SensorResult } from '../../store/ppgStore';
import { useAuthStore } from '../../store/authStore';
import HardwareService from '../../services/HardwareService';
import DemoService from '../../services/DemoService';

import { MainTabParamList } from '../../navigation/MainNavigator';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;

// ─── Stres seviyesi config ───────────────────────────────────

type StressConfig = {
  label: string;
  emoji: string;
  gradientStart: string;
  gradientEnd: string;
  bgColor: string;
};

const STRESS_CONFIG: Record<StressLevel, StressConfig> = {
  relaxed:  { label: 'Rahat',        emoji: '😌', gradientStart: '#1D9E75', gradientEnd: '#2DC58F', bgColor: '#E1F5EE' },
  moderate: { label: 'Orta Stres',   emoji: '😐', gradientStart: '#F59E0B', gradientEnd: '#FBBF24', bgColor: '#FEF3C7' },
  high:     { label: 'Yüksek Stres', emoji: '😰', gradientStart: '#EF4444', gradientEnd: '#F87171', bgColor: '#FEE2E2' },
};

// ─── Mini metrik kartı ───────────────────────────────────────

function MetricCard({
  icon, label, value, unit, color,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <View style={[styles.metricCard, Shadow.sm]}>
      <View style={[styles.metricIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

// ─── Stres skor göstergesi ───────────────────────────────────

function StressGauge({ score, config }: { score: number; config: StressConfig }) {
  return (
    <LinearGradient
      colors={[config.gradientStart, config.gradientEnd]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.stressCard, Shadow.md]}
    >
      <View style={styles.stressTop}>
        <View>
          <Text style={styles.stressCardLabel}>Stres Seviyesi</Text>
          <Text style={styles.stressLevelText}>{config.emoji}  {config.label}</Text>
        </View>
        <View style={styles.scoreCircle}>
          <Text style={styles.scoreValue}>{score}</Text>
          <Text style={styles.scoreUnit}>/100</Text>
        </View>
      </View>
      {/* Progress bar */}
      <View style={styles.stressBarBg}>
        <View style={[styles.stressBarFill, { width: `${score}%` }]} />
      </View>
    </LinearGradient>
  );
}

// ─── Geçmiş mini grafik ──────────────────────────────────────

function HistoryBar({ history }: { history: SensorResult[] }) {
  if (history.length < 2) return null;

  const colorMap: Record<StressLevel, string> = {
    relaxed: Colors.success,
    moderate: '#F59E0B',
    high: Colors.error,
  };

  return (
    <View style={[styles.historyCard, Shadow.sm]}>
      <Text style={styles.historyTitle}>Son {history.length} Ölçüm</Text>
      <View style={styles.historyBars}>
        {history.map((r, i) => (
          <View key={i} style={styles.historyBarWrap}>
            <View
              style={[
                styles.historyBarFill,
                {
                  height: `${r.stress_score}%`,
                  backgroundColor: colorMap[r.status],
                  opacity: 0.3 + (i / history.length) * 0.7,
                },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Sağlık hatırlatma banner'ı ──────────────────────────────

const BANNER_QUESTIONS = [
  { label: '💊 İlaçlarımı aldım mı?',  message: 'Son PPG ölçümüm tamamlandı. Bugün ilaçlarımı alıp almadığımı hatırlatır mısın?' },
  { label: '🍽️ Yemek yedim mi?',       message: 'Son PPG ölçümüm bitti. Bugün düzenli yemek yiyip yemediğimi analiz eder misin?' },
  { label: '📊 Sonucu analiz et',       message: 'Az önce PPG ölçümüm tamamlandı. Stres seviyemi ve genel sağlık durumumu yorumlar mısın?' },
];

function HealthCheckBanner({
  onAsk,
  onDismiss,
}: {
  onAsk: (msg: string) => void;
  onDismiss: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(120)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  }, [slideAnim]);

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.bannerHeader}>
        <View style={styles.bannerTitleRow}>
          <Text style={styles.bannerEmoji}>✅</Text>
          <Text style={styles.bannerTitle}>Ölçüm tamamlandı!</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      <Text style={styles.bannerSubtitle}>AI asistanına bir şey sormak ister misin?</Text>
      <View style={styles.bannerChips}>
        {BANNER_QUESTIONS.map((q) => (
          <TouchableOpacity
            key={q.label}
            style={styles.bannerChip}
            onPress={() => onAsk(q.message)}
            activeOpacity={0.75}
          >
            <Text style={styles.bannerChipText}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Ana ekran ───────────────────────────────────────────────

export default function DashboardScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const user = useAuthStore((s) => s.user);
  const { bleState, connectedDeviceName, latestResult, resultHistory, latestMlResult, mlLoading, mlError } = usePpgStore();

  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isConnecting,  setIsConnecting]  = useState(false);
  const [showBanner,    setShowBanner]    = useState(false);

  const bannerTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastShownSessionRef = useRef<string | null>(null);

  const isConnected = bleState === 'connected';

  // Demo toggle
  const handleToggleDemo = useCallback(() => {
    if (isDemoRunning) {
      DemoService.stop();
      setIsDemoRunning(false);
    } else {
      DemoService.start();
      setIsDemoRunning(true);
    }
  }, [isDemoRunning]);

  // BLE bağlantı toggle
  const handleToggleBle = useCallback(async () => {
    if (isConnected) {
      await HardwareService.disconnect();
    } else {
      setIsConnecting(true);
      try {
        await HardwareService.startScan();
      } catch {
        Alert.alert(
          'Bağlantı Hatası',
          'PPG sensörü bulunamadı. Bluetooth açık ve cihaz yakın olduğundan emin olun.',
        );
      } finally {
        setIsConnecting(false);
      }
    }
  }, [isConnected]);

  // ─── Yeni ML sonucu gelince banner göster ──────────────────
  useEffect(() => {
    if (!latestMlResult) return;
    if (lastShownSessionRef.current === latestMlResult.session_id) return;
    lastShownSessionRef.current = latestMlResult.session_id;

    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      setShowBanner(true);
      dismissTimerRef.current = setTimeout(() => setShowBanner(false), 10_000);
    }, 4_000);
  }, [latestMlResult]);

  // Banner'ı soran butona basınca Chat'e yönlendir
  const handleBannerAsk = useCallback((message: string) => {
    setShowBanner(false);
    if (bannerTimerRef.current)  clearTimeout(bannerTimerRef.current);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    navigation.navigate('Chat', { initialMessage: message });
  }, [navigation]);

  const handleBannerDismiss = useCallback(() => {
    setShowBanner(false);
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (DemoService.isRunning()) DemoService.stop();
      if (bannerTimerRef.current)  clearTimeout(bannerTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // Ana stres göstergesi → ML sonucunu kullan
  const stressCfg    = latestMlResult ? STRESS_CONFIG[latestMlResult.stress_level] : null;
  const needsBaseline  = !!latestResult && !latestMlResult && !mlLoading && mlError === 'no_baseline';
  const hasBackendError = !!latestResult && !latestMlResult && !mlLoading && mlError === 'backend_error';
  const hasNetworkError = !!latestResult && !latestMlResult && !mlLoading && mlError === 'network_error';

  const bleStatusLabel: Record<typeof bleState, string> = {
    disconnected: 'Bağlı Değil',
    scanning:     'Taranıyor…',
    connecting:   'Bağlanıyor…',
    connected:    connectedDeviceName ?? 'Bağlı',
    error:        'Bağlantı Hatası',
  };
  const bleStatusColor: Record<typeof bleState, string> = {
    disconnected: Colors.textMuted,
    scanning:     '#F59E0B',
    connecting:   '#F59E0B',
    connected:    Colors.success,
    error:        Colors.error,
  };

  return (
    <SafeAreaView style={[styles.safe, { paddingBottom: tabBarHeight }]} edges={['top']}>
      {/* ── Sağlık Hatırlatma Banner'ı ── */}
      {showBanner && (
        <HealthCheckBanner
          onAsk={handleBannerAsk}
          onDismiss={handleBannerDismiss}
        />
      )}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Merhaba, {user?.full_name?.split(' ')[0] ?? 'Yeşim'} 👋</Text>
              <Text style={styles.subheading}>Stres izleme aktif</Text>
            </View>
          </View>

          {/* ── Stres Kartı (ML sonucu) ── */}
          {stressCfg ? (
            <StressGauge score={latestMlResult!.stress_score} config={stressCfg} />
          ) : mlLoading ? (
            <View style={[styles.stressPlaceholder, Shadow.sm]}>
              <ActivityIndicator size="large" color={Colors.primaryMid} />
              <Text style={styles.placeholderText}>ML modeli analiz ediyor…</Text>
            </View>
          ) : needsBaseline ? (
            <View style={[styles.stressPlaceholder, Shadow.sm]}>
              <Ionicons name="analytics-outline" size={36} color="#F59E0B" />
              <Text style={styles.placeholderText}>
                {'Kişisel baseline gerekli.\nProfil → Baseline Kalibrasyonu yapın.'}
              </Text>
            </View>
          ) : hasBackendError ? (
            <View style={[styles.stressPlaceholder, Shadow.sm]}>
              <Ionicons name="cloud-offline-outline" size={36} color={Colors.error} />
              <Text style={styles.placeholderText}>
                {'Sunucu hatası oluştu.\nBir sonraki ölçümde otomatik tekrar denenecek.'}
              </Text>
            </View>
          ) : hasNetworkError ? (
            <View style={[styles.stressPlaceholder, Shadow.sm]}>
              <Ionicons name="wifi-outline" size={36} color={Colors.error} />
              <Text style={styles.placeholderText}>
                {'İnternet bağlantısı yok.\nBağlantı sağlandığında otomatik devam eder.'}
              </Text>
            </View>
          ) : (
            <View style={[styles.stressPlaceholder, Shadow.sm]}>
              <Ionicons name="pulse-outline" size={36} color={Colors.border} />
              <Text style={styles.placeholderText}>
                {isConnected ? 'Sensörden veri bekleniyor…' : 'Sensörü bağlamak için Tara & Bağlan\'a bas'}
              </Text>
            </View>
          )}

          {/* ── Metrikler ── */}
          <View style={styles.metricsRow}>
            <MetricCard
              icon="heart"
              label="Kalp Hızı"
              value={latestResult ? String(latestResult.hr) : '--'}
              unit="bpm"
              color="#EF4444"
            />
            <MetricCard
              icon="pulse"
              label="HRV"
              value={latestResult ? String(latestResult.hrv) : '--'}
              unit="ms"
              color={Colors.primaryMid}
            />
          </View>

          {/* ── ML Detay Kartı (anlık BLE-ML sonucu) ── */}
          {latestMlResult && latestResult && (
            <View style={[styles.mlCard, Shadow.sm]}>
              <View style={styles.mlHeader}>
                <Text style={styles.mlTitle}>🧠 Railway ML · robust9_z</Text>
                <Text style={styles.mlTime}>
                  {new Date(latestMlResult.analyzed_at.endsWith('Z') ? latestMlResult.analyzed_at : latestMlResult.analyzed_at + 'Z')
                    .toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.mlBody}>
                <View style={[styles.mlBadge, { backgroundColor: STRESS_CONFIG[latestMlResult.stress_level].bgColor }]}>
                  <Text style={{ fontSize: 18 }}>{STRESS_CONFIG[latestMlResult.stress_level].emoji}</Text>
                  <Text style={[styles.mlBadgeText, { color: STRESS_CONFIG[latestMlResult.stress_level].gradientStart }]}>
                    {STRESS_CONFIG[latestMlResult.stress_level].label}
                  </Text>
                </View>
                <View style={styles.mlStats}>
                  <Text style={styles.mlStat}>p_stress: <Text style={{ fontWeight: '700' }}>{(latestMlResult.p_stress * 100).toFixed(0)}%</Text></Text>
                  <Text style={styles.mlStat}>HR: <Text style={{ fontWeight: '700' }}>{latestResult.hr} bpm</Text></Text>
                  <Text style={styles.mlStat}>HRV: <Text style={{ fontWeight: '700' }}>{latestResult.hrv} ms</Text></Text>
                </View>
              </View>
            </View>
          )}

          {/* ── Geçmiş ── */}
          <HistoryBar history={resultHistory} />

          {/* ── BLE Bağlantı ── */}
          <View style={[styles.deviceCard, Shadow.sm]}>
            <View style={styles.deviceLeft}>
              <View style={[styles.deviceDot, { backgroundColor: bleStatusColor[bleState] }]} />
              <View>
                <Text style={styles.deviceLabel}>PPG Sensör</Text>
                <Text style={[styles.deviceStatus, { color: bleStatusColor[bleState] }]}>
                  {bleStatusLabel[bleState]}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.connectBtn, isConnected && styles.connectBtnDisconnect]}
              onPress={handleToggleBle}
              disabled={bleState === 'scanning' || bleState === 'connecting' || isConnecting}
              activeOpacity={0.8}
            >
              {isConnecting || bleState === 'scanning' || bleState === 'connecting' ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name={isConnected ? 'bluetooth' : 'bluetooth-outline'}
                    size={14}
                    color={Colors.white}
                  />
                  <Text style={styles.connectBtnText}>
                    {isConnected ? 'Bağlantıyı Kes' : 'Tara & Bağlan'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.background },
  inner: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.lg },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  greeting:  { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  subheading:{ fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  // Stres kartı
  stressCard: { borderRadius: Radius.xl, padding: Spacing.xl },
  stressPlaceholder: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm, minHeight: 110, justifyContent: 'center',
  },
  placeholderText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  stressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  stressCardLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  stressLevelText: { fontSize: FontSize.xl, fontWeight: '700', color: '#fff', marginTop: 4 },
  scoreCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  scoreValue: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  scoreUnit:  { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)' },
  stressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: Radius.full, overflow: 'hidden' },
  stressBarFill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: Radius.full },

  // Metrikler
  metricsRow: { flexDirection: 'row', gap: Spacing.md },
  metricCard: {
    flex: 1, backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  metricIcon: { width: 36, height: 36, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  metricValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: 4 },
  metricValue: { fontSize: FontSize.xl, fontWeight: '700' },
  metricUnit:  { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 3 },

  // Geçmiş
  // ML kart
  mlCard: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg },
  mlHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  mlTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  mlTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  mlBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  mlBadge: { borderRadius: Radius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, alignItems: 'center', gap: 4 },
  mlBadgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  mlStats: { gap: 4, flex: 1 },
  mlStat: { fontSize: FontSize.xs, color: Colors.textMuted },

  historyCard: {
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  historyTitle: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.sm },
  historyBars:  { flexDirection: 'row', alignItems: 'flex-end', height: 48, gap: 3 },
  historyBarWrap: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  historyBarFill: { borderRadius: 3, width: '100%' },

  // Demo butonu
  demoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  demoBtnActive: { backgroundColor: Colors.primaryMid, borderColor: Colors.primaryMid },
  demoBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primaryMid },

  // Cihaz kartı
  deviceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderRadius: Radius.lg,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  deviceLeft:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  deviceDot:    { width: 10, height: 10, borderRadius: 5 },
  deviceLabel:  { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  deviceStatus: { fontSize: FontSize.xs, marginTop: 2 },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primaryMid, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, borderRadius: Radius.full,
    minWidth: 110, justifyContent: 'center', minHeight: 36,
  },
  connectBtnDisconnect: { backgroundColor: Colors.error },
  connectBtnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '600' },

  // ─── Sağlık Banner ───
  banner: {
    position: 'absolute',
    bottom: 96,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 100,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  bannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannerEmoji:   { fontSize: 16 },
  bannerTitle:   { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  bannerSubtitle:{ fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md },
  bannerChips:   { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  bannerChip: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerChipText: { fontSize: FontSize.xs, color: Colors.primaryMid, fontWeight: '600' },
});
