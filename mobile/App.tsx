import React from 'react';
import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { useStressNotifications } from './src/hooks/useStressNotifications';

function AppContent() {
  // Stres yüksekken bildirim gönder
  useStressNotifications();
  return <RootNavigator />;
}

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <AppContent />
    </>
  );
}
