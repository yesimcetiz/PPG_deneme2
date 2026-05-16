import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DashboardScreen from '../screens/main/DashboardScreen';
import AIChatScreen from '../screens/main/AIChatScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import EditProfileScreen from '../screens/main/EditProfileScreen';
import AdminScreen from '../screens/main/AdminScreen';
import BaselineCalibrationScreen from '../screens/main/BaselineCalibrationScreen';
import { Colors, FontSize } from '../constants/theme';

// ─── Tip listeleri ────────────────────────────────────────────

export type MainTabParamList = {
  Dashboard: undefined;
  Chat: { initialMessage?: string } | undefined;
  History: undefined;
  Profile: undefined;
};

// Ana stack (tab + modal ekranlar)
export type MainStackParamList = {
  Tabs: undefined;
  EditProfile: undefined;
  Admin: undefined;
  BaselineCalibration: undefined;
};

const Tab   = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<MainStackParamList>();

// ─── Tab ikonları & etiketler ─────────────────────────────────

type TabIconName = 'pulse' | 'chatbubble-ellipses' | 'bar-chart' | 'person-circle';

const TAB_ICONS: Record<keyof MainTabParamList, TabIconName> = {
  Dashboard: 'pulse',
  Chat:      'chatbubble-ellipses',
  History:   'bar-chart',
  Profile:   'person-circle',
};

const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Dashboard: 'Dashboard',
  Chat:      'AI Chat',
  History:   'Geçmiş',
  Profile:   'Profil',
};

// ─── Bottom Tab ───────────────────────────────────────────────

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const name = route.name as keyof MainTabParamList;
        return {
          headerShown: false,
          tabBarIcon: ({ focused, size }) => (
            <View style={focused ? styles.activeIconWrap : styles.iconWrap}>
              <Ionicons
                name={TAB_ICONS[name]}
                size={size}
                color={focused ? Colors.primaryGradientStart : Colors.textMuted}
              />
            </View>
          ),
          tabBarLabel: TAB_LABELS[name],
          tabBarActiveTintColor: Colors.primaryGradientStart,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarLabelStyle: styles.label,
          tabBarStyle: [
            styles.tabBar,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ],
          tabBarBackground: () => <View style={styles.tabBarBg} />,
        };
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Chat"      component={AIChatScreen} />
      <Tab.Screen name="History"   component={HistoryScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Ana Stack (Tab + modallar) ───────────────────────────────

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs"        component={TabNavigator} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="BaselineCalibration"
        component={BaselineCalibrationScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
}

// ─── Stiller ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? 84 : 64,
    elevation: 0,
    shadowOpacity: 0,
    backgroundColor: 'transparent',
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 10,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: Platform.OS === 'android' ? 4 : 0,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  activeIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
  },
});
