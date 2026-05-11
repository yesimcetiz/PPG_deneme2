import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Rect, Path } from 'react-native-svg';
import { usePpgStore, StressLevel } from '../../store/ppgStore';
import { useAuthStore } from '../../store/authStore';
import HardwareService from '../../services/HardwareService';
import DemoService from '../../services/DemoService';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - Spacing.xl * 2;
const CHART_H = 140;
const CHART_PADDING = 12;

// ─── Stress config ────────────────────────────────────────────

type StressConfig = {
  label: string;
  emoji: string;
  gradientStart: string;
  gradientEnd: string;
  textColor: string;
  bgColor: string;
};

const STRESS_CONFIG: Record<StressLevel, StressConfig> = {
  relaxed: {
    label: 'Relaxed',
    emoji: '😌',
    gradientStart: '#1D9E75',
    gradientEnd: '#2DC58F',
    textColor: '#fff',
    bgColor: '#E1F5EE',
  },
  moderate: {
    label: 'Moderate',
    emoji: '😐',
    gradientStart: '#F59E0B',
    gradientEnd: '#FBBF24',
    textColor: '#fff',
    bgColor: '#FEF3C7',
  },
  high: {
    label: 'High Stress',
    emoji: '😰',
    gradientStart: '#EF4444',
    gradientEnd: '#F87171',
    textColor: '#fff',
    bgColor: '#FEE2E2',
  },
};

// ─── PPG Waveform chart ───────────────────────────────────────

interface PpgChartProps {
  data: number[]; // normalised 0–1 values
}

function PpgChart({ data }: PpgChartProps) {
  if (data.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Waiting for signal…</Text>
      </View>
    );
  }

  const usableW = CHART_W - CHART_PADDING * 2;
  const usableH = CHART_H - CHART_PADDING * 2;

  const step = usableW / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = CHART_PADDING + i * step;
      // invert y: 1 → top, 0 → bottom
      const y = CHART_PADDING + (1 - v) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Build filled area path
  const firstX = CHART_PADDING;
  const lastX = CHART_PADDING + (data.length - 1) * step;
  const bottomY = CHART_PADDING + usableH;
  const areaPath = `M ${firstX},${bottomY} L ${points
    .split(' ')
    .map((p) => p)
    .join(' L ')} L ${lastX},${bottomY} Z`;

  return (
    <Svg width={CHART_W} height={CHART_H}>
      <Defs>
        <SvgGradient id="ppgArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={Colors.primaryGradientStart} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={Colors.primaryGradientStart} stopOpacity="0.02" />
        </SvgGradient>
      </Defs>

      {/* Horizontal grid lines */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const y = CHART_PADDING + (1 - frac) * usableH;
        return (
          <Line
            key={frac}
            x1={CHART_PADDING}
            y1={y}
            x2={CHART_W - CHART_PADDING}
            y2={y}
            stroke={Colors.border}
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        );
      })}

      {/* Filled area */}
      <Path d={areaPath} fill="url(#ppgArea)" />

      {/* Signal line */}
      <Polyline
        points={points}
        fill="none"
        stroke={Colors.primaryGradientStart}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ─── Metric card ─────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent?: string;
}

function MetricCard({ label, value, unit, icon, accent = Colors.primaryMid }: MetricCardProps) {
  return (
    <View style={[styles.metricCard, Shadow.sm]}>
      <View style={[styles.metricIconWrap, { backgroundColor: accent + '18' }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color: accent }]}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const {
    bleState,
    connectedDeviceName,
    ppgBuffer,
    heartRate,
    hrvRmssd,
    stressLevel,
    stressScore,
  } = usePpgStore();

  const [isConnecting, setIsConnecting] = useState(false);
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  // Extract just the normalised values for the chart (last 100 pts for performance)
  const chartData = ppgBuffer.slice(-100).map((s) => s.value);

  const isConnected = bleState === 'connected';

  const handleToggleConnection = useCallback(async () => {
    if (isConnected) {
      await HardwareService.disconnect();
    } else {
      setIsConnecting(true);
      try {
        await HardwareService.startScan();
      } catch (err) {
        Alert.alert(
          'Connection Failed',
          'Could not find or connect to a PPG sensor. Make sure Bluetooth is enabled and the device is nearby.',
        );
      } finally {
        setIsConnecting(false);
      }
    }
  }, [isConnected]);

  const handleToggleDemo = useCallback(() => {
    if (isDemoRunning) {
      DemoService.stop();
      setIsDemoRunning(false);
    } else {
      DemoService.start();
      setIsDemoRunning(true);
    }
  }, [isDemoRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (DemoService.isRunning()) DemoService.stop();
    };
  }, []);

  const stressCfg = stressLevel ? STRESS_CONFIG[stressLevel] : null;

  const bleStatusLabel: Record<typeof bleState, string> = {
    disconnected: 'Not Connected',
    scanning:     'Scanning…',
    connecting:   'Connecting…',
    connected:    connectedDeviceName ?? 'Connected',
    error:        'Connection Error',
  };

  const bleStatusColor: Record<typeof bleState, string> = {
    disconnected: Colors.textMuted,
    scanning:     Colors.warning,
    connecting:   Colors.warning,
    connected:    Colors.success,
    error:        Colors.error,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hello, {user?.full_name?.split(' ')[0] ?? 'there'} 👋
            </Text>
            <Text style={styles.subheading}>Real-time stress monitoring</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Stress Level Card ── */}
        {stressCfg ? (
          <LinearGradient
            colors={[stressCfg.gradientStart, stressCfg.gradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.stressCard, Shadow.md]}
          >
            <View style={styles.stressTop}>
              <View>
                <Text style={styles.stressCardLabel}>Current Stress Level</Text>
                <Text style={styles.stressLevelText}>
                  {stressCfg.emoji}  {stressCfg.label}
                </Text>
              </View>
              {stressScore !== null && (
                <View style={styles.scoreCircle}>
                  <Text style={styles.scoreValue}>{stressScore}</Text>
                  <Text style={styles.scoreUnit}>/100</Text>
                </View>
              )}
            </View>
            <View style={styles.stressBarBg}>
              <View
                style={[
                  styles.stressBarFill,
                  { width: `${stressScore ?? 0}%` },
                ]}
              />
            </View>
          </LinearGradient>
        ) : (
          <View style={[styles.stressCardPlaceholder, Shadow.sm]}>
            <Ionicons name="pulse-outline" size={32} color={Colors.border} />
            <Text style={styles.placeholderText}>
              {isConnected ? 'Analyzing…' : 'Connect a device to see your stress level'}
            </Text>
          </View>
        )}

        {/* ── Metrics Row ── */}
        <View style={styles.metricsRow}>
          <MetricCard
            label="Heart Rate"
            value={heartRate != null ? String(Math.round(heartRate)) : '--'}
            unit="bpm"
            icon="heart"
            accent="#EF4444"
          />
          <MetricCard
            label="HRV (RMSSD)"
            value={hrvRmssd != null ? String(Math.round(hrvRmssd)) : '--'}
            unit="ms"
            icon="pulse"
            accent={Colors.primaryMid}
          />
        </View>

        {/* ── PPG Waveform ── */}
        <View style={[styles.chartCard, Shadow.sm]}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>PPG Signal</Text>
            <View style={styles.liveDot}>
              <View
                style={[
                  styles.liveDotInner,
                  { backgroundColor: isConnected ? Colors.success : Colors.border },
                ]}
              />
              <Text
                style={[
                  styles.liveLabel,
                  { color: isConnected ? Colors.success : Colors.textMuted },
                ]}
              >
                {isConnected ? 'LIVE' : 'IDLE'}
              </Text>
            </View>
          </View>
          <PpgChart data={chartData} />
        </View>

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

        {/* ── Device Connection ── */}
        <View style={[styles.deviceCard, Shadow.sm]}>
          <View style={styles.deviceLeft}>
            <View style={[styles.deviceDot, { backgroundColor: bleStatusColor[bleState] }]} />
            <View>
              <Text style={styles.deviceLabel}>BLE Sensor</Text>
              <Text style={[styles.deviceStatus, { color: bleStatusColor[bleState] }]}>
                {bleStatusLabel[bleState]}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.connectBtn,
              isConnected && styles.connectBtnDisconnect,
            ]}
            onPress={handleToggleConnection}
            disabled={bleState === 'scanning' || bleState === 'connecting' || isConnecting}
            activeOpacity={0.8}
          >
            {(bleState === 'scanning' || bleState === 'connecting' || isConnecting) ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons
                  name={isConnected ? 'bluetooth' : 'bluetooth-outline'}
                  size={14}
                  color={Colors.white}
                />
                <Text style={styles.connectBtnText}>
                  {isConnected ? 'Disconnect' : 'Scan & Connect'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  greeting: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  subheading: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  settingsBtn: { padding: 6 },

  // Stress card
  stressCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  stressCardPlaceholder: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    minHeight: 100,
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  stressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  stressCardLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  stressLevelText: { fontSize: FontSize.xl, fontWeight: '700', color: '#fff', marginTop: 4 },
  scoreCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scoreValue: { fontSize: FontSize.lg, fontWeight: '800', color: '#fff' },
  scoreUnit: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)' },
  stressBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  stressBarFill: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: Radius.full,
  },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  metricValueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginTop: 4 },
  metricValue: { fontSize: FontSize.xl, fontWeight: '700' },
  metricUnit: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 3 },

  // PPG Chart
  chartCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  chartTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDotInner: { width: 7, height: 7, borderRadius: 4 },
  liveLabel: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.5 },
  chartEmpty: {
    height: CHART_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Device card
  deviceCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  deviceLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  deviceDot: { width: 10, height: 10, borderRadius: 5 },
  deviceLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  deviceStatus: { fontSize: FontSize.xs, marginTop: 2 },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryMid,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    minWidth: 120,
    justifyContent: 'center',
    minHeight: 36,
  },
  connectBtnDisconnect: { backgroundColor: Colors.error },
  connectBtnText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '600' },

  // Demo butonu
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    justifyContent: 'center',
  },
  demoBtnActive: {
    backgroundColor: Colors.primaryMid,
    borderColor: Colors.primaryMid,
  },
  demoBtnText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primaryMid,
  },
});
