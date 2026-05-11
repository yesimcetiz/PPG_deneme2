import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthHeader from '../../components/ui/AuthHeader';
import InputField from '../../components/ui/InputField';
import GradientButton from '../../components/ui/GradientButton';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding2'>;

export default function OnboardingStep2Screen({ navigation, route }: Props) {
  const { step1 } = route.params;

  const [diagnoses, setDiagnoses] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState<string[]>([]);
  const [medInput, setMedInput] = useState('');

  function addMed() {
    const trimmed = medInput.trim();
    if (!trimmed) return;
    setMedications((prev) => [...prev, trimmed]);
    setMedInput('');
  }

  function removeMed(idx: number) {
    setMedications((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleNext() {
    navigation.navigate('Onboarding3', {
      step1,
      step2: {
        diagnoses: diagnoses.trim() || undefined,
        medications: medications.length
          ? JSON.stringify(medications.map((m) => ({ name: m })))
          : undefined,
        allergies: allergies.trim() || undefined,
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
            <Text style={styles.stepLabel}>Adım 2 / 3 — Sağlık durumu</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '66%' }]} />
            </View>

            <Text style={styles.title}>Sağlık bilgilerin</Text>
            <Text style={styles.subtitle}>
              Yapay zekanın sana özel yanıtlar verebilmesi için bu bilgileri paylaş.
            </Text>

            <InputField
              label="Kronik hastalıklar / tanılar (varsa)"
              value={diagnoses}
              onChangeText={setDiagnoses}
              placeholder="örn. Tip 1 diyabet, hipertansiyon"
              multiline
            />

            {/* İlaç ekleme */}
            <Text style={styles.fieldLabel}>Kullandığın ilaçlar</Text>
            <View style={styles.medInputRow}>
              <View style={{ flex: 1 }}>
                <InputField
                  label=""
                  value={medInput}
                  onChangeText={setMedInput}
                  placeholder="örn. Metformin 500mg — sabah"
                  onSubmitEditing={addMed}
                  returnKeyType="done"
                />
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={addMed}>
                <Text style={styles.addBtnText}>+ Ekle</Text>
              </TouchableOpacity>
            </View>

            {medications.length > 0 && (
              <View style={styles.medList}>
                {medications.map((m, i) => (
                  <View key={i} style={styles.medChip}>
                    <Text style={styles.medChipText}>{m}</Text>
                    <TouchableOpacity onPress={() => removeMed(i)} style={styles.removeBtn}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <InputField
              label="Alerji (varsa)"
              value={allergies}
              onChangeText={setAllergies}
              placeholder="örn. Penisilin, aspirin"
            />

            <GradientButton
              label="Devam et"
              onPress={handleNext}
              style={{ marginTop: Spacing.xl }}
            />
            <GradientButton
              label="Şimdi değil, atla"
              onPress={() =>
                navigation.navigate('Onboarding3', { step1, step2: {} })
              }
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
    marginTop: Spacing.md,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  medInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  addBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    justifyContent: 'center',
    marginBottom: 0,
  },
  addBtnText: { color: Colors.primaryMid, fontWeight: '600', fontSize: FontSize.sm },
  medList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  medChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingVertical: Spacing.xs,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    gap: 6,
  },
  medChipText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '500' },
  removeBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primaryMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
});
