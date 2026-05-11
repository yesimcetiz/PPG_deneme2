import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { profileApi, HealthProfilePayload } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { Colors, FontSize, Radius, Shadow, Spacing } from '../../constants/theme';

type NavProp = NativeStackNavigationProp<MainStackParamList>;

// ─── Profile row ──────────────────────────────────────────────

interface ProfileRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string | number | null;
  unit?: string;
}

function ProfileRow({ icon, label, value, unit }: ProfileRowProps) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={Colors.primaryMid} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>
        {value}
        {unit ? ` ${unit}` : ''}
      </Text>
    </View>
  );
}

// ─── Section card ─────────────────────────────────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <View style={[styles.section, Shadow.sm]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const { user, logout } = useAuthStore();
  const [profile, setProfile] = useState<
    (HealthProfilePayload & { id: number; user_id: number }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await profileApi.get();
        setProfile(data);
      } catch {
        // No profile yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, [logout]);

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  const age = profile?.birth_year
    ? new Date().getFullYear() - profile.birth_year
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar / User Card ── */}
        <LinearGradient
          colors={[Colors.primaryGradientStart, Colors.primaryGradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarCard}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.full_name ?? '—'}</Text>
            <Text style={styles.userEmail}>{user?.email ?? '—'}</Text>
          </View>
          <View style={{ gap: 6 }}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Ionicons name="pencil" size={13} color={Colors.primaryMid} />
              <Text style={styles.editBtnText}>Düzenle</Text>
            </TouchableOpacity>
            {user?.role === 'admin' && (
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                onPress={() => navigation.navigate('Admin')}
              >
                <Ionicons name="shield-checkmark" size={13} color="#fff" />
                <Text style={[styles.editBtnText, { color: '#fff' }]}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* ── Health Profile ── */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primaryMid} />
          </View>
        ) : profile ? (
          <>
            <Section title="Physical Info">
              <ProfileRow icon="body-outline"     label="Age"    value={age}                unit="years" />
              <ProfileRow icon="male-female"      label="Gender" value={profile.gender} />
              <ProfileRow icon="resize-outline"   label="Height" value={profile.height_cm}  unit="cm" />
              <ProfileRow icon="barbell-outline"  label="Weight" value={profile.weight_kg}  unit="kg" />
            </Section>

            <Section title="Medical History">
              <ProfileRow icon="medkit-outline"   label="Diagnoses"   value={profile.diagnoses} />
              <ProfileRow icon="tablet-portrait"  label="Medications" value={profile.medications} />
              <ProfileRow icon="alert-circle"     label="Allergies"   value={profile.allergies} />
            </Section>

            <Section title="Stress Profile">
              <ProfileRow icon="cloud-outline"        label="Stress Source"      value={profile.stress_source} />
              <ProfileRow icon="speedometer-outline"  label="Avg Stress (1–10)"  value={profile.avg_stress_level} />
            </Section>
          </>
        ) : (
          <View style={[styles.section, Shadow.sm, styles.noProfileCard]}>
            <Ionicons name="person-add-outline" size={32} color={Colors.border} />
            <Text style={styles.noProfileText}>No health profile yet.</Text>
            <Text style={styles.noProfileSub}>
              Complete onboarding to personalize your AI health assistant.
            </Text>
          </View>
        )}

        {/* ── Account info ── */}
        <Section title="Account">
          <ProfileRow
            icon="calendar-outline"
            label="Member since"
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString([], {
              month: 'long',
              year: 'numeric',
            }) : undefined}
          />
          <ProfileRow
            icon="shield-checkmark-outline"
            label="Status"
            value={user?.is_active ? 'Active' : 'Inactive'}
          />
        </Section>

        {/* ── Sign Out ── */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          {loggingOut ? (
            <ActivityIndicator color={Colors.error} size="small" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              <Text style={styles.logoutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.versionText}>Stress Less v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, gap: Spacing.lg },

  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
  userName: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  userEmail: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  editBtnText: { fontSize: FontSize.xs, color: Colors.primaryMid, fontWeight: '700' },

  section: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.md,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  infoValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, flexShrink: 1, textAlign: 'right' },

  noProfileCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  noProfileText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  noProfileSub: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },

  center: { paddingVertical: Spacing.xl, alignItems: 'center' },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.error,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.errorLight,
    marginTop: Spacing.sm,
  },
  logoutText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.error },

  versionText: {
    textAlign: 'center',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
});
