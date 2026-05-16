import React, { useCallback, useEffect, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ppgApi, PpgSessionSummary } from '../../services/api';
import { StressLevel } from '../../store/ppgStore';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';

// ─── Stress badge config ──────────────────────────────────────

type BadgeConfig = { label: string; bg: string; text: string; icon: string };

const STRESS_BADGE: Record<StressLevel, BadgeConfig> = {
  relaxed:  { label: 'Rahat',   bg: '#E1F5EE', text: '#1D9E75', icon: '😌' },
  moderate: { label: 'Orta',    bg: '#FEF3C7', text: '#854F0B', icon: '😐' },
  high:     { label: 'Yüksek',  bg: '#FEE2E2', text: '#B91C1C', icon: '😰' },
};

function StressBadge({ level }: { level: StressLevel }) {
  const cfg = STRESS_BADGE[level];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={styles.badgeEmoji}>{cfg.icon}</Text>
      <Text style={[styles.badgeText, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

// ─── Session row ──────────────────────────────────────────────

function SessionRow({ item }: { item: PpgSessionSummary }) {
  const date = new Date(item.analyzed_at);
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.row, Shadow.sm]}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowDate}>{dateStr}</Text>
        <Text style={styles.rowTime}>{timeStr}</Text>
      </View>

      <View style={styles.rowMetrics}>
        <View style={styles.metricPair}>
          <Ionicons name="heart" size={12} color="#EF4444" />
          <Text style={styles.metricText}>
            {Math.round(item.heart_rate)} <Text style={styles.metricUnit}>bpm</Text>
          </Text>
        </View>
        <View style={styles.metricPair}>
          <Ionicons name="pulse" size={12} color={Colors.primaryMid} />
          <Text style={styles.metricText}>
            {Math.round(item.hrv_rmssd)} <Text style={styles.metricUnit}>ms</Text>
          </Text>
        </View>
      </View>

      <StressBadge level={item.stress_level} />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function HistoryScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [sessions, setSessions] = useState<PpgSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await ppgApi.history(50);
      setSessions(data);
    } catch {
      setError('Geçmiş yüklenemedi. Yenilemek için aşağı çekin.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory(true);
  }, [fetchHistory]);

  // Summary stats
  const total = sessions.length;
  const avgHR = total > 0
    ? Math.round(sessions.reduce((s, r) => s + r.heart_rate, 0) / total)
    : null;
  const highStressPct = total > 0
    ? Math.round((sessions.filter((s) => s.stress_level === 'high').length / total) * 100)
    : null;

  return (
    <SafeAreaView style={[styles.safe, { paddingBottom: tabBarHeight }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Ölçüm Geçmişi</Text>
        <Text style={styles.subtitle}>{total} kayıtlı oturum</Text>
      </View>

      {/* Summary strip */}
      {total > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{total}</Text>
            <Text style={styles.summaryLabel}>Oturum</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{avgHR ?? '--'}</Text>
            <Text style={styles.summaryLabel}>Ort. KH (bpm)</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, highStressPct && highStressPct > 40 ? { color: Colors.error } : {}]}>
              {highStressPct ?? '--'}%
            </Text>
            <Text style={styles.summaryLabel}>Yüksek Stres</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primaryMid} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.border} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchHistory()} style={styles.retryBtn}>
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : total === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bar-chart-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyText}>Henüz oturum yok.</Text>
          <Text style={styles.emptySubtext}>Ölçüm başlatmak için PPG sensörünü bağlayın.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.session_id}
          renderItem={({ item }) => <SessionRow item={item} />}
          contentContainerStyle={[styles.list, { paddingBottom: 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primaryMid}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  summaryLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  divider: { width: 1, backgroundColor: Colors.border, marginVertical: 4 },

  list: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  rowLeft: { flex: 1 },
  rowDate: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  rowTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  rowMetrics: { gap: 4 },
  metricPair: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: FontSize.xs, color: Colors.text, fontWeight: '600' },
  metricUnit: { fontWeight: '400', color: Colors.textMuted },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeEmoji: { fontSize: 12 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  errorText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: Spacing.xl },
  emptyText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  emptySubtext: { fontSize: FontSize.sm, color: Colors.textMuted },
  retryBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
  },
  retryText: { fontSize: FontSize.sm, color: Colors.primaryMid, fontWeight: '600' },
});
