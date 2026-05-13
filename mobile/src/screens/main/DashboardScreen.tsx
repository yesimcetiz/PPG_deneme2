/**
 * DashboardScreen.tsx — Scenario B
 * ESP32'den gelen işlenmiş stres sonucunu gösterir.
 * Ham PPG grafiği yok — sadece stres skoru, HR, HRV ve bağlantı durumu.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePpgStore, StressLevel, SensorResult } from '../../store/ppgStore';
import { useAuthStore } from '../../store/authStore';
import HardwareService from '../../services/HardwareService';
import DemoService from '../../services/DemoService';
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

// ─── Ana ekran ───────────────────────────────────────────────

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const { bleState, connectedDeviceName, latestResult, resultHistory } = usePpgStore();

  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isConnecting,  setIsConnecting]  = useState(false);

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

  useEffect(() => {
    return () => {
      if (DemoService.isRunning()) DemoService.stop();
    };
  }, []);

  const stressCfg  = latestResult ? STRESS_CONFIG[latestResult.status] : null;

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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 96 }}
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

          {/* ── Stres Kartı ── */}
          {stressCfg ? (
            <StressGauge score={latestResult!.stress_score} config={stressCfg} />
          ) : (
            <View style={[styles.stressPlaceholder, Shadow.sm]}>
              <Ionicons name="pulse-outline" size={36} color={Colors.border} />
              <Text style={styles.placeholderText}>
                {isConnected ? 'Sensörden veri bekleniyor…' : 'Sensörü bağla veya Demo Modunu başlat'}
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

          {/* ── Geçmiş ── */}
          <HistoryBar history={resultHistory} />

          {/* ── Demo Modu ── */}
          <TouchableOpacity
            style={[styles.demoBtn, isDemoRunning && styles.demoBtnActive]}
            onPress={handleToggleDemo}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isDemoRunning ? 'stop-circle' : 'flask'}
              size={16}
              color={isDemoRunning ? Colors.white : Colors.primaryMid}
            />
            <Text style={[styles.demoBtnText, isDemoRunning && { color: Colors.white }]}>
              {isDemoRunning ? 'Demo Durdur' : 'Demo Modunu Başlat (Donanımsız Test)'}
            </Text>
          </TouchableOpacity>

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
});
