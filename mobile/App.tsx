import React from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { useStressNotifications } from './src/hooks/useStressNotifications';

Sentry.init({
  dsn: 'https://e6417a7723d16c32d3b606aa3e4c1f04@o4511387536654336.ingest.de.sentry.io/4511387569094736',
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 0.2,
  // Kişisel veri gönderme
  sendDefaultPii: false,
});

function AppContent() {
  // Stres yüksekken bildirim gönder
  useStressNotifications();
  return <RootNavigator />;
}

export default Sentry.wrap(function App() {
  return (
    <>
      <StatusBar style="light" />
      <AppContent />
    </>
  );
});
