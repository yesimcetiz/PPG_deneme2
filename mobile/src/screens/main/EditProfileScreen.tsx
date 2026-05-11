import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { profileApi, HealthProfilePayload } from '../../services/api';
import InputField from '../../components/ui/InputField';
import GradientButton from '../../components/ui/GradientButton';
import { MainStackParamList } from '../../navigation/MainNavigator';
import { Colors, FontSize, Radius, Spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<MainStackParamList, 'EditProfile'>;

const GENDERS = ['Kadın', 'Erkek', 'Belirtmek istemiyorum'];
const STRESS_SOURCES = ['İş', 'Okul', 'Aile', 'İlişki', 'Sağlık', 'Diğer'];
const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function EditProfileScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form alanları
  const [birthYear, setBirthYear] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [gender, setGender] = useState('');
  const [diagnoses, setDiagnoses] = useState('');
  const [medications, setMedications] = useState<string[]>([]);
  const [medInput, setMedInput] = useState('');
  const [allergies, setAllergies] = useState('');
  const [stressSources, setStressSources] = useState<string[]>([]);
  const [stressLevel, setStressLevel] = useState(5);

  // Mevcut profili yükle
  useEffect(() => {
    (async () => {
      try {
        const p = await profileApi.get();
        if (p.birth_year) setBirthYear(String(p.birth_year));
        if (p.height_cm)  setHeightCm(String(p.height_cm));
        if (p.weight_kg)  setWeightKg(String(p.weight_kg));
        if (p.gender)     setGender(p.gender);
        if (p.diagnoses)  setDiagnoses(p.diagnoses);
        if (p.allergies)  setAllergies(p.allergies);
        if (p.avg_stress_level) setStressLevel(p.avg_stress_level);
        if (p.stress_source) {
          setStressSources(p.stress_source.split(',').map((s) => s.trim()).filter(Boolean));
        }
        if (p.medications) {
          try {
            const parsed = JSON.parse(p.medications);
            if (Array.isArray(parsed)) {
              setMedications(parsed.map((m: { name: string } | string) =>
                typeof m === 'object' ? m.name : m
              ));
            }
          } catch {
            setMedications([p.medications]);
          }
        }
      } catch {
        // Profil yok — boş form
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggleSource(s: string) {
    setStressSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  function addMed() {
    const t = medInput.trim();
    if (!t) return;
    setMedications((prev) => [...prev, t]);
    setMedInput('');
  }

  function removeMed(idx: number) {
    setMedications((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload: HealthProfilePayload = {
        birth_year:       birthYear ? Number(birthYear) : undefined,
        height_cm:        heightCm  ? Number(heightCm)  : undefined,
        weight_kg:        weightKg  ? Number(weightKg)  : undefined,
        gender:           gender    || undefined,
        diagnoses:        diagnoses.trim() || undefined,
        medications:      medications.length
          ? JSON.stringify(medications.map((m) => ({ name: m })))
          : undefined,
        allergies:        allergies.trim() || undefined,
        stress_source:    stressSources.join(',') || undefined,
        avg_stress_level: stressLevel,
      };
      await profileApi.update(payload);
      Alert.alert('Kaydedildi', 'Profil bilgilerin güncellendi.', [
        { text: 'Tamam', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Hata', 'Profil kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  const levelColor = stressLevel <= 3 ? Colors.success : stressLevel <= 6 ? '#BA7517' : Colors.error;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primaryMid} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profili Düzenle</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Kişisel Bilgiler ── */}
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>

          <InputField
            label="Doğum yılı"
            value={birthYear}
            onChangeText={setBirthYear}
            keyboardType="number-pad"
            placeholder="örn. 1998"
            maxLength={4}
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField
                label="Boy (cm)"
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="decimal-pad"
                placeholder="örn. 168"
              />
            </View>
            <View style={{ flex: 1 }}>
              <InputField
                label="Kilo (kg)"
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
                placeholder="örn. 58"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Cinsiyet</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, gender === g && styles.chipActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Sağlık Bilgileri ── */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Sağlık Bilgileri</Text>

          <InputField
            label="Kronik hastalıklar / tanılar"
            value={diagnoses}
            onChangeText={setDiagnoses}
            placeholder="örn. Tip 1 diyabet, hipertansiyon"
            multiline
          />

          <Text style={styles.fieldLabel}>Kullandığın ilaçlar</Text>
          <View style={styles.medInputRow}>
            <View style={{ flex: 1 }}>
              <InputField
                label=""
                value={medInput}
                onChangeText={setMedInput}
                placeholder="İlaç adı ve doz"
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
            label="Alerjiler"
            value={allergies}
            onChangeText={setAllergies}
            placeholder="örn. Penisilin, aspirin"
          />

          {/* ── Stres Profili ── */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Stres Profili</Text>

          <Text style={styles.fieldLabel}>Stres kaynakları</Text>
          <View style={styles.chipRow}>
            {STRESS_SOURCES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, stressSources.includes(s) && styles.chipActive]}
                onPress={() => toggleSource(s)}
              >
                <Text style={[styles.chipText, stressSources.includes(s) && styles.chipTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            Ortalama stres seviyesi —{' '}
            <Text style={{ color: levelColor, fontWeight: '700' }}>
              {stressLevel}/10
            </Text>
          </Text>
          <View style={styles.levelRow}>
            {LEVELS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.levelBtn,
                  stressLevel === n && { backgroundColor: Colors.primary },
                  n < stressLevel && { backgroundColor: Colors.primaryLight },
                ]}
                onPress={() => setStressLevel(n)}
              >
                <Text style={[
                  styles.levelBtnText,
                  stressLevel === n && { color: Colors.white, fontWeight: '700' },
                ]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.levelTrack}>
            <View style={[styles.levelTrackFill, { width: `${stressLevel * 10}%`, backgroundColor: levelColor }]} />
          </View>

          <GradientButton
            label="Kaydet"
            onPress={handleSave}
            loading={saving}
            style={{ marginTop: Spacing.xl, marginBottom: Spacing.xxxl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
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
  medInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  addBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    justifyContent: 'center',
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
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.primaryMid,
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  levelRow: { flexDirection: 'row', gap: 4, marginBottom: Spacing.sm },
  levelBtn: {
    flex: 1, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  levelBtnText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  levelTrack: { height: 4, backgroundColor: Colors.primaryLight, borderRadius: 2, overflow: 'hidden' },
  levelTrackFill: { height: '100%', borderRadius: 2 },
});
