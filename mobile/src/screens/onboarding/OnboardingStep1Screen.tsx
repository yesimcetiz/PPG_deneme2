import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import AuthHeader from '../../components/ui/AuthHeader';
import InputField from '../../components/ui/InputField';
import GradientButton from '../../components/ui/GradientButton';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Onboarding1'>;

const GENDERS = ['Kadın', 'Erkek', 'Belirtmek istemiyorum'];

export default function OnboardingStep1Screen({ navigation }: Props) {
  const [birthYear, setBirthYear] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!birthYear || isNaN(Number(birthYear))) e.birthYear = 'Geçerli bir yıl gir.';
    if (!height || isNaN(Number(height))) e.height = 'Geçerli bir boy gir.';
    if (!weight || isNaN(Number(weight))) e.weight = 'Geçerli bir kilo gir.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (!validate()) return;
    navigation.navigate('Onboarding2', {
      step1: {
        birth_year: Number(birthYear),
        height_cm: Number(height),
        weight_kg: Number(weight),
        gender,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
          <AuthHeader />

          <View style={styles.body}>
            {/* Progress */}
            <Text style={styles.stepLabel}>Adım 1 / 3 — Temel bilgiler</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '33%' }]} />
            </View>

            <Text style={styles.title}>Seni tanıyalım</Text>
            <Text style={styles.subtitle}>
              Bu bilgiler stres analizinin daha doğru olmasını sağlar.
            </Text>

            <InputField
              label="Doğum yılı"
              value={birthYear}
              onChangeText={setBirthYear}
              error={errors.birthYear}
              keyboardType="number-pad"
              placeholder="örn. 1998"
              maxLength={4}
            />
            <InputField
              label="Boy (cm)"
              value={height}
              onChangeText={setHeight}
              error={errors.height}
              keyboardType="decimal-pad"
              placeholder="örn. 168"
            />
            <InputField
              label="Kilo (kg)"
              value={weight}
              onChangeText={setWeight}
              error={errors.weight}
              keyboardType="decimal-pad"
              placeholder="örn. 58"
            />

            <Text style={styles.fieldLabel}>Cinsiyet</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gender === g && styles.chipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <GradientButton
              label="Devam et"
              onPress={handleNext}
              style={{ marginTop: Spacing.xl }}
            />
            <GradientButton
              label="Şimdi değil, atla"
              onPress={() => navigation.navigate('Onboarding2', { step1: {} })}
              variant="outline"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primaryMid,
    borderRadius: 2,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  chipTextActive: { color: Colors.white, fontWeight: '600' },
});
