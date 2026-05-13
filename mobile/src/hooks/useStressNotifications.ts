/**
 * useStressNotifications.ts
 * ESP32'den gelen latestResult.status izlenir; "high" olduğunda bildirim gönderilir.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { usePpgStore, StressLevel } from '../store/ppgStore';

const COOLDOWN_MS = 10 * 60 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
    shouldShowBanner: true,
    shouldShowList:  true,
  }),
});

const STRESS_MESSAGES: Record<StressLevel, { title: string; body: string } | null> = {
  relaxed:  null,
  moderate: null,
  high: {
    title: '⚠️ Yüksek Stres Tespit Edildi',
    body:  'Sensörün yüksek stres ölçtü. Derin nefes almayı dene veya AI asistanına danış.',
  },
};

async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export function useStressNotifications() {
  // Yeni store: status latestResult içinde
  const status      = usePpgStore((s) => s.latestResult?.status ?? null);
  const lastSentRef = useRef<number>(0);
  const permGranted = useRef<boolean>(false);

  useEffect(() => {
    requestPermission().then((g) => { permGranted.current = g; });
  }, []);

  useEffect(() => {
    if (!status || !permGranted.current) return;
    const msg = STRESS_MESSAGES[status];
    if (!msg) return;

    const now = Date.now();
    if (now - lastSentRef.current < COOLDOWN_MS) return;
    lastSentRef.current = now;

    Notifications.scheduleNotificationAsync({
      content: { title: msg.title, body: msg.body, sound: true },
      trigger: null,
    });
  }, [status]);
}
