import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthHeader from '../../components/ui/AuthHeader';
import GradientButton from '../../components/ui/GradientButton';
import { profileApi } from '../../services/api';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding3'>;

const STRESS_SOURCES = ['İş', 'Okul', 'Aile', 'İlişki', 'Sağlık', 'Diğer'];
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function OnboardingStep3Screen({ navigation, route }: Props) {
  const { step1, step2 } = route.params;

  const [sources, setSources] = useState<string[]>([]);
  const [level, setLevel] = useState(5);
  const [loading, setLoading] = useState(false);

  function toggleSource(s: string) {
    setSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleFinish() {
    setLoading(true);
    try {
      await profileApi.update({
        ...step1,
        ...step2,
        stress_source: sources.join(',') || undefined,
        avg_stress_level: level,
      });
    } catch {
      // Profil güncelleme başarısız olsa da ana ekrana geç
    } finally {
      setLoading(false);
    }
    // RootNavigator authenticated user'ı ana tab'e yönlendirir
  }

  const levelColor = level <= 3 ? Colors.success : level <= 6 ? '#BA7517' : Colors.error;
  const levelLabel = level <= 3 ? 'Düşük' : level <= 6 ? 'Orta' : 'Yüksek';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <AuthHeader />

        <View style={styles.body}>
          <Text style={styles.stepLabel}>Adım 3 / 3 — Stres geçmişi</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>

          <Text style={styles.title}>Stres profilin</Text>
          <Text style={styles.subtitle}>
            Hangi konular seni strese sokuyor?
          </Text>

          <Text style={styles.fieldLabel}>Stres kaynakları</Text>
          <View style={styles.chipRow}>
            {STRESS_SOURCES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, sources.includes(s) && styles.chipActive]}
                onPress={() => toggleSource(s)}
              >
                <Text style={[styles.chipText, sources.includes(s) && styles.chipTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            Ortalama stres seviyesi —{' '}
            <Text style={[styles.levelBadge, { color: levelColor }]}>
              {level}/10 · {levelLabel}
            </Text>
          </Text>
          <View style={styles.levelRow}>
            {LEVELS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.levelBtn,
                  level === n && { backgroundColor: Colors.primary },
                  n <= level && n !== level && { backgroundColor: Colors.primaryLight },
                ]}
                onPress={() => setLevel(n)}
              >
                <Text
                  style={[
                    styles.levelBtnText,
                    level === n && { color: Colors.white, fontWeight: '700' },
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.levelTrack}>
            <View
              style={[
                styles.levelTrackFill,
                {
                  width: `${level * 10}%`,
                  backgroundColor: levelColor,
                },
              ]}
            />
          </View>

          <GradientButton
            label="Tamamla"
            onPress={handleFinish}
            loading={loading}
            style={{ marginTop: Spacing.xl }}
          />
          <GradientButton
            label="Atla"
            onPress={handleFinish}
            variant="outline"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, backgroundColor: Colors.background },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  stepLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm },
  progressBar: {
    height: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 2,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primaryMid, borderRadius: 2 },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  levelBadge: { fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: '600' },
  levelRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  levelBtn: {
    flex: 1,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  levelTrack: {
    height: 4,
    backgroundColor: Colors.primaryLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  levelTrackFill: { height: '100%', borderRadius: 2 },
});
