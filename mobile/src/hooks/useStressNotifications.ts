/**
 * useStressNotifications.ts
 * ──────────────────────────────────────────────────────────────────────────
 * ppgStore'daki stressLevel değerini izler; "high" olduğunda yerel push
 * notification gönderir.
 *
 * Kurallar:
 *  - Aynı "high" bildirimini 10 dakika içinde tekrar gösterme (cooldown)
 *  - İzin reddedildiyse sessizce çık, kullanıcıyı rahatsız etme
 *  - App ön planda bile bildirim göster (iOS için gerekli ayar dahil)
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { usePpgStore, StressLevel } from '../store/ppgStore';

const COOLDOWN_MS = 10 * 60 * 1000; // 10 dakika

// Bildirim sunum ayarları (app ön planda iken de göster)
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
  relaxed:  null, // bildirim gönderme
  moderate: null,
  high: {
    title: '⚠️ Yüksek Stres Tespit Edildi',
    body:  'Sensörün yüksek stres seviyesi ölçtü. Derin nefes almayı dene veya AI asistanına danış.',
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
  const stressLevel  = usePpgStore((s) => s.stressLevel);
  const lastSentRef  = useRef<number>(0);
  const permGranted  = useRef<boolean>(false);

  // İzni uygulama başlangıcında iste
  useEffect(() => {
    requestPermission().then((granted) => {
      permGranted.current = granted;
    });
  }, []);

  // stressLevel değişince kontrol et
  useEffect(() => {
    if (!stressLevel || !permGranted.current) return;

    const msg = STRESS_MESSAGES[stressLevel];
    if (!msg) return; // relaxed/moderate → bildirim yok

    const now = Date.now();
    if (now - lastSentRef.current < COOLDOWN_MS) return; // cooldown aktif

    lastSentRef.current = now;

    Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body:  msg.body,
        sound: true,
      },
      trigger: null, // hemen gönder
    });
  }, [stressLevel]);
}
