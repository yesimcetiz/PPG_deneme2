import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  adminApi, AdminStats, AdminUserRow, AdminAuditLog, PpgSessionSummary,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';

// ─── Sekme tanımı ─────────────────────────────────────────────

type Tab = 'stats' | 'users' | 'ppg' | 'logs';

const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'stats', label: 'Özet',      icon: 'stats-chart' },
  { key: 'users', label: 'Kullanıcı', icon: 'people' },
  { key: 'ppg',   label: 'PPG',       icon: 'pulse' },
  { key: 'logs',  label: 'Loglar',    icon: 'list' },
];

// ─── İstatistik kartı ─────────────────────────────────────────

function StatCard({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ComponentProps<typeof Ionicons>['name']; color: string;
}) {
  return (
    <View style={[styles.statCard, Shadow.sm]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Kullanıcı satırı ─────────────────────────────────────────

function UserRow({ user, onToggle }: { user: AdminUserRow; onToggle: (u: AdminUserRow) => void }) {
  return (
    <View style={styles.row}>
      <View style={[styles.roleTag, { backgroundColor: user.role === 'admin' ? Colors.primaryLight : Colors.surface }]}>
        <Text style={[styles.roleTagText, { color: user.role === 'admin' ? Colors.primaryMid : Colors.textMuted }]}>
          {user.role}
        </Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{user.full_name}</Text>
        <Text style={styles.rowSub}>{user.email}</Text>
        <Text style={styles.rowMeta}>
          {new Date(user.created_at).toLocaleDateString('tr-TR')}
          {user.ppg_session_count != null ? ` · ${user.ppg_session_count} seans` : ''}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.toggleBtn, { backgroundColor: user.is_active ? Colors.successLight : Colors.errorLight }]}
        onPress={() => onToggle(user)}
      >
        <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: user.is_active ? Colors.success : Colors.error }}>
          {user.is_active ? 'Aktif' : 'Pasif'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Log satırı ───────────────────────────────────────────────

function LogRow({ log }: { log: AdminAuditLog }) {
  return (
    <View style={styles.logRow}>
      <View style={styles.logLeft}>
        <Text style={styles.logAction}>{log.action}</Text>
        <Text style={styles.logMeta}>
          {log.user_email ?? 'sistem'} · {log.resource}
          {log.resource_id ? ` #${log.resource_id}` : ''}
        </Text>
      </View>
      <Text style={styles.logTime}>
        {new Date(log.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

// ─── PPG satırı ───────────────────────────────────────────────

const STRESS_COLOR: Record<string, string> = {
  relaxed: Colors.success,
  moderate: '#B45309',
  high: Colors.error,
};

function PpgRow({ s }: { s: PpgSessionSummary }) {
  return (
    <View style={styles.row}>
      <View style={[styles.stressDot, { backgroundColor: STRESS_COLOR[s.stress_level] ?? Colors.textMuted }]} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{s.stress_level.toUpperCase()} · Skor {s.stress_score}</Text>
        <Text style={styles.rowSub}>HR {Math.round(s.heart_rate)} bpm · HRV {Math.round(s.hrv_rmssd)} ms</Text>
        <Text style={styles.rowMeta}>{new Date(s.analyzed_at).toLocaleString('tr-TR')}</Text>
      </View>
    </View>
  );
}

// ─── Ana Ekran ────────────────────────────────────────────────

export default function AdminScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats]   = useState<AdminStats | null>(null);
  const [users, setUsers]   = useState<AdminUserRow[]>([]);
  const [ppg, setPpg]       = useState<PpgSessionSummary[]>([]);
  const [logs, setLogs]     = useState<AdminAuditLog[]>([]);

  // Yetkisiz erişim koruması
  useEffect(() => {
    if (user?.role !== 'admin') {
      Alert.alert('Erişim Reddedildi', 'Bu alana sadece admin kullanıcılar erişebilir.');
      navigation.goBack();
    }
  }, [user?.role]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, u, p, l] = await Promise.all([
        adminApi.stats(),
        adminApi.users(),
        adminApi.ppgOutputs(),
        adminApi.auditLogs(),
      ]);
      setStats(s); setUsers(u); setPpg(p); setLogs(l);
    } catch {
      Alert.alert('Hata', 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleToggleUser = useCallback((u: AdminUserRow) => {
    Alert.alert(
      u.is_active ? 'Kullanıcıyı Deaktif Et' : 'Kullanıcıyı Aktif Et',
      `${u.full_name} adlı kullanıcı ${u.is_active ? 'deaktif' : 'aktif'} edilsin mi?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            try {
              await adminApi.toggleUserActive(u.id, !u.is_active);
              fetchAll(true);
            } catch {
              Alert.alert('Hata', 'İşlem başarısız.');
            }
          },
        },
      ],
    );
  }, [fetchAll]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.primaryMid]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Admin Paneli</Text>
          <Text style={styles.headerSub}>Stress Less v1.0</Text>
        </View>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
      </LinearGradient>

      {/* Sekmeler */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={activeTab === t.key ? Colors.primaryMid : Colors.textMuted}
            />
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primaryMid} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchAll(true); }}
              tintColor={Colors.primaryMid}
            />
          }
        >
          {/* ── STATS ── */}
          {activeTab === 'stats' && stats && (
            <View style={styles.statsGrid}>
              <StatCard label="Toplam Kullanıcı" value={stats.total_users}        icon="people"           color={Colors.primaryMid} />
              <StatCard label="Aktif Kullanıcı"  value={stats.active_users}       icon="person-circle"    color={Colors.success} />
              <StatCard label="PPG Seansı"        value={stats.total_ppg_sessions} icon="pulse"            color="#8B5CF6" />
              <StatCard label="Chat Mesajı"       value={stats.total_chat_messages} icon="chatbubbles"     color="#3B82F6" />
              <StatCard label="Yüksek Stres"      value={stats.high_stress_sessions} icon="warning"        color={Colors.error} />
              <StatCard
                label="Stres Oranı"
                value={`${stats.total_ppg_sessions > 0
                  ? Math.round((stats.high_stress_sessions / stats.total_ppg_sessions) * 100)
                  : 0}%`}
                icon="analytics"
                color="#F59E0B"
              />
            </View>
          )}

          {/* ── USERS ── */}
          {activeTab === 'users' && (
            <View style={styles.list}>
              <Text style={styles.listHeader}>{users.length} kullanıcı</Text>
              {users.map((u) => (
                <UserRow key={u.id} user={u} onToggle={handleToggleUser} />
              ))}
            </View>
          )}

          {/* ── PPG ── */}
          {activeTab === 'ppg' && (
            <View style={styles.list}>
              <Text style={styles.listHeader}>Son {ppg.length} PPG seansı</Text>
              {ppg.map((s) => <PpgRow key={s.session_id} s={s} />)}
            </View>
          )}

          {/* ── LOGS ── */}
          {activeTab === 'logs' && (
            <View style={styles.list}>
              <Text style={styles.listHeader}>Son {logs.length} kayıt</Text>
              {logs.map((l) => <LogRow key={l.id} log={l} />)}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Stiller ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  headerSub:   { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },
  adminBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
  adminBadgeText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '700', letterSpacing: 0.5 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: Colors.primaryMid },
  tabLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  tabLabelActive: { color: Colors.primaryMid, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.lg, paddingBottom: 40 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: 4,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted },

  list: { gap: Spacing.sm },
  listHeader: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  roleTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    minWidth: 42,
    alignItems: 'center',
  },
  roleTagText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  rowSub:   { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
  rowMeta:  { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  toggleBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  stressDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  logLeft:   { flex: 1 },
  logAction: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.text },
  logMeta:   { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  logTime:   { fontSize: 10, color: Colors.textMuted },
});
