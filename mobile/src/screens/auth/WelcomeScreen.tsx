import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import AuthHeader from '../../components/ui/AuthHeader';
import GradientButton from '../../components/ui/GradientButton';
import { Colors, FontSize, Spacing } from '../../constants/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <AuthHeader tall />

        <View style={styles.body}>
          <Text style={styles.title}>Hoş geldin</Text>
          <Text style={styles.subtitle}>
            PPG sensörünle stresini ölç, kişisel sağlık geçmişini takip et ve yapay zeka ile sohbet et.
          </Text>

          <GradientButton
            label="Giriş yap"
            onPress={() => navigation.navigate('Login')}
            style={{ marginTop: Spacing.xl }}
          />
          <GradientButton
            label="Hesap oluştur"
            onPress={() => navigation.navigate('Register')}
            variant="outline"
          />

          <Text style={styles.legal}>
            Devam ederek{' '}
            <Text style={styles.legalLink}>gizlilik politikasını</Text> ve{' '}
            <Text style={styles.legalLink}>kullanım koşullarını</Text> kabul edersin.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, backgroundColor: Colors.background },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  legal: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.primaryMid,
    fontWeight: '500',
  },
});
