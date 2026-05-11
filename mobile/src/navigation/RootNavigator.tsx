import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import AuthNavigator from './AuthNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import MainNavigator from './MainNavigator';
import { Colors } from '../constants/theme';

/**
 * Routing mantığı:
 *  1. isLoading          → spinner
 *  2. !isAuthenticated   → AuthNavigator  (Welcome / Login / Register)
 *  3. !onboardingComplete → OnboardingNavigator (3 adım)
 *  4. isAuthenticated + onboardingComplete → MainNavigator (ana uygulama)
 */
export default function RootNavigator() {
  const { isAuthenticated, isLoading, onboardingComplete, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {!isAuthenticated ? (
          <AuthNavigator />
        ) : !onboardingComplete ? (
          <OnboardingNavigator />
        ) : (
          <MainNavigator />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
