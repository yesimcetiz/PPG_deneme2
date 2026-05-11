import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthHeader from '../../components/ui/AuthHeader';
import InputField from '../../components/ui/InputField';
import GradientButton from '../../components/ui/GradientButton';
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../services/api';
import { Colors, FontSize, Spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const register = useAuthStore((s) => s.register);

  function validate() {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = 'Ad Soyad gerekli.';
    if (!email.trim()) e.email = 'Email gerekli.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Geçerli bir email gir.';
    if (password.length < 6) e.password = 'Şifre en az 6 karakter olmalı.';
    if (password !== confirm) e.confirm = 'Şifreler eşleşmiyor.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await register(fullName.trim(), email.trim().toLowerCase(), password);
      // Başarılı → onboarding'e yönlendir
      navigation.navigate('Onboarding1');
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : 'Bağlantı hatası.';
      if (err instanceof ApiError && err.status === 400) {
        setErrors({ email: 'Bu email zaten kayıtlı.' });
      } else {
        setErrors({ general: msg });
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
        <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
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
              placeholder="Ezgi Dok"
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
              placeholder="En az 6 karakter"
            />
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
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
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
