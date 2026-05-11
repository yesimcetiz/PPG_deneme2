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
import { useAuthStore } from '../../store/authStore';
import { ApiError } from '../../services/api';
import { Colors, FontSize, Spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const login = useAuthStore((s) => s.login);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email gerekli.';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Geçerli bir email gir.';
    if (!password) e.password = 'Şifre gerekli.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await login(email.trim().toLowerCase(), password);
      // Navigation otomatik: RootNavigator auth state'i izler
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : 'Bağlantı hatası.';
      if (err instanceof ApiError && err.status === 401) {
        setErrors({ password: 'Email veya şifre hatalı.' });
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
            <Text style={styles.title}>Giriş yap</Text>
            <Text style={styles.subtitle}>Tekrar hoş geldin!</Text>

            {errors.general && (
              <View style={styles.generalError}>
                <Text style={styles.generalErrorText}>{errors.general}</Text>
              </View>
            )}

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
              placeholder="••••••••"
            />

            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgot}>Şifremi unuttum</Text>
            </TouchableOpacity>

            <GradientButton
              label="Giriş yap"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: Spacing.lg }}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Hesabın yok mu? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.switchLink}>Kayıt ol</Text>
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
  forgotRow: { alignSelf: 'flex-end', marginTop: Spacing.sm },
  forgot: { fontSize: FontSize.sm, color: Colors.primaryMid, fontWeight: '500' },
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
