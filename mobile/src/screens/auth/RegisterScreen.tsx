import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View, Text, StyleSheet,
  ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthHeader from '../../components/ui/AuthHeader';
import InputField from '../../components/ui/InputField';
import GradientButton from '../../components/ui/GradientButton';
import PasswordStrengthBar, { validatePassword } from '../../components/ui/PasswordStrengthBar';
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../services/api';
import { Colors, FontSize, Spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(false);

  const register = useAuthStore((s) => s.register);

  // ── Client-side validation ────────────────────────────────
  /**
   * Backend ile aynı kuralları burada da uyguluyoruz.
   * Neden? Kullanıcıya hızlı geri bildirim vermek için.
   * Backend yine de doğrular — bu sadece UX iyileştirmesi.
   */
  function validate(): boolean {
    const e: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      e.fullName = 'Ad soyad en az 2 karakter olmalı.';
    }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      e.email = 'Geçerli bir email gir.';
    }

    // PasswordStrengthBar ile aynı mantığı kullanan validatePassword()
    const { isValid, errors: pwErrors } = validatePassword(password);
    if (!isValid) {
      e.password = pwErrors[0]; // İlk hatayı göster
    }
    if (password !== confirm) {
      e.confirm = 'Şifreler eşleşmiyor.';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Kayıt işlemi ─────────────────────────────────────────
  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});

    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
      /**
       * Navigation YOK — kasıtlı!
       * register() çağrısı sonrası authStore'da isAuthenticated=true,
       * onboardingComplete=false olur. RootNavigator bu değişikliği
       * izlediği için otomatik olarak OnboardingNavigator'ı gösterir.
       * Manuel navigate() yapmak gerekmez, zaten çalışmaz da
       * (OnboardingNavigator, AuthNavigator'ın içinde değil).
       */
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          // "Bu email zaten kayıtlı"
          setErrors({ email: err.detail });
        } else if (err.status === 422) {
          // Pydantic validation hatası — backend'den gelen mesajı göster
          // detail genellikle şu formatta: "Şifre şunları içermeli: en az 8 karakter."
          setErrors({ password: err.detail });
        } else {
          setErrors({ general: err.detail || 'Bir hata oluştu.' });
        }
      } else {
        setErrors({ general: 'Bağlantı hatası. Backend çalışıyor mu?' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <AuthHeader />

          <View style={styles.body}>
            <Text style={styles.title}>Hesap oluştur</Text>
            <Text style={styles.subtitle}>Birkaç adımda başla</Text>

            {errors.general && (
              <View style={styles.generalError}>
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

            <InputField
              label="Ad Soyad"
              value={fullName}
              onChangeText={setFullName}
              error={errors.fullName}
              placeholder="Yeşim Cetiz"
              autoComplete="name"
            />
            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              placeholder="ornek@email.com"
              autoComplete="email"
            />
            <InputField
              label="Şifre"
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              isPassword
              placeholder="En az 8 karakter"
            />

            {/* Şifre güç göstergesi — kullanıcı yazmaya başlayınca görünür */}
            <PasswordStrengthBar password={password} />

            <InputField
              label="Şifre tekrar"
              value={confirm}
              onChangeText={setConfirm}
              error={errors.confirm}
              isPassword
              placeholder="••••••••"
            />

            <GradientButton
              label="Hesap oluştur"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: Spacing.lg }}
              // Tüm kurallar geçilmeden butonu disable et
              disabled={!!password && !validatePassword(password).isValid}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Zaten hesabın var mı? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.switchLink}>Giriş yap</Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  title:    { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  switchText: { fontSize: FontSize.sm, color: Colors.textMuted },
  switchLink: { fontSize: FontSize.sm, color: Colors.primaryMid, fontWeight: '600' },
  generalError: {
    backgroundColor: Colors.errorLight,
    borderRadius: 8,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  generalErrorText: { fontSize: FontSize.sm, color: Colors.error },
});
