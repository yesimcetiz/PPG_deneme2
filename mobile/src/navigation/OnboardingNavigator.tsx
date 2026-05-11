import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import OnboardingStep1Screen from '../screens/onboarding/OnboardingStep1Screen';
import OnboardingStep2Screen from '../screens/onboarding/OnboardingStep2Screen';
import OnboardingStep3Screen from '../screens/onboarding/OnboardingStep3Screen';

export type OnboardingStackParamList = {
  Onboarding1: undefined;
  Onboarding2: { step1: Record<string, unknown> };
  Onboarding3: { step1: Record<string, unknown>; step2: Record<string, unknown> };
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding1" component={OnboardingStep1Screen} />
      <Stack.Screen name="Onboarding2" component={OnboardingStep2Screen} />
      <Stack.Screen name="Onboarding3" component={OnboardingStep3Screen} />
    </Stack.Navigator>
  );
}
