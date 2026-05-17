/**
 * BaselineCalibrationScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Kullanıcı 90 saniye boyunca dinlenme pozisyonunda beklerken ESP32'den
 * gelen SensorResult paketlerini toplar, istatistik hesaplar ve
 * POST /ppg/baseline ile backend'e gönderir.
 *
 * Firmware v1 uyumluluğu:
 *   - mean_nn eksikse → 60000 / hr formülüyle tahmin edilir
 *   - sdnn   eksikse → hrv * 1.15 kaba tahmini kullanılır
 *   - motion eksikse → 0.01 (dinlenme varsayımı)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePpgStore, SensorResult } from '../../store/ppgStore';
import { baselineApi, BaselinePayload, ApiError } from '../../services/api';
import { Colors, FontSize } from '../../constants/theme';
import { MainStackParamList } from '../../navigation/MainNavigator';

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Sabitler ────────────────────────────────────────────────
const CALIBRATION_DURATION_S = 90;
const MIN_SAMPLES             = 3;

type CalibrationPhase =
  | 'idle'
  | 'counting'
  | 'calculating'
  | 'uploading'
  | 'done'
  | 'error';

// ─── Yardımcı istatistik fonksiyonları ───────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], m?: number): number {
  if (arr.length < 2) return 0;
  const mu = m ?? mean(arr);
  const variance = arr.reduce((s, v) => s + (v - mu) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function buildPayload(samples: SensorResult[]): BaselinePayload {
  const hrArr     = samples.map(s => s.hr);
  const rmssdArr  = samples.map(s => s.hrv);
  const sdnnArr   = samples.map(s => s.sdnn    ?? s.hrv * 1.15);
  const meanNnArr = samples.map(s => s.mean_nn ?? 60000 / s.hr);
  const motionArr = samples.map(s => s.motion  ?? 0.01);

  const hrMean     = mean(hrArr);
  const rmssdMean  = mean(rmssdArr);
  const sdnnMean   = mean(sdnnArr);
  const meanNnMean = mean(meanNnArr);
  const motionMean = mean(motionArr);

  return {
    mean_hr_mean:    hrMean,
    mean_hr_std:     std(hrArr,     hrMean),
    rmssd_mean:      rmssdMean,
    rmssd_std:       std(rmssdArr,  rmssdMean),
    sdnn_mean:       sdnnMean,
    sdnn_std:        std(sdnnArr,   sdnnMean),
    mean_nn_mean:    meanNnMean,
    mean_nn_std:     std(meanNnArr, meanNnMean),
    motion_std_mean: motionMean,
    motion_std_std:  std(motionArr, motionMean),
  };
}

// ─── Bileşen ──────────────────────────────────────────────────

export default function BaselineCalibrationScreen() {
  const navigation = useNavigation<Nav>();
  const { bleState, resultHistory } = usePpgStore();

  const [phase,          setPhase]          = useState<CalibrationPhase>('idle');
  const [secondsLeft,    setSecondsLeft]    = useState(CALIBRATION_DURATION_S);
  const [sampleCount,    setSampleCount]    = useState(0);
  const [errorMsg,       setErrorMsg]       = useState('');
  const [nSessionsAfter, setNSessionsAfter] = useState<number | null>(null);

  const startTimestamp  = useRef(0);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected = bleState === 'connected';

  const startCalibration = useCallback(() => {
    if (!isConnected) {
      Alert.alert('Bağlantı Gerekli', 'Lütfen önce ESP32 sensörüne bağlanın.');
      return;
    }
    startTimestamp.current = Date.now();
    setPhase('counting');
    setSecondsLeft(CALIBRATION_DURATION_S);
    setSampleCount(0);

    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setPhase('calculating');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isConnected]);

  // Canlı sample sayısı
  useEffect(() => {
    if (phase === 'counting') {
      const count = resultHistory.filter(s => s.timestamp >= startTimestamp.current).length;
      setSampleCount(count);
    }
  }, [resultHistory.length, phase]);

  // Süre dolunca hesapla + gönder
  useEffect(() => {
    if (phase !== 'calculating') return;

    const samples = resultHistory.filter(s => s.timestamp >= startTimestamp.current);

    if (samples.length < MIN_SAMPLES) {
      setErrorMsg(
        `Yeterli veri toplanamadı (${samples.length}/${MIN_SAMPLES} paket). ` +
        'Sensör bağlı ve veri gönderiyor olmalı.'
      );
      setPhase('error');
      return;
    }

    const payload = buildPayload(samples);
    setPhase('uploading');

    baselineApi.update(payload)
      .then(res => {
        setNSessionsAfter(res.n_sessions);
        setPhase('done');
      })
      .catch((err: unknown) => {
        const detail = err instanceof ApiError ? err.detail : 'Sunucu hatası';
        setErrorMsg(detail);
        setPhase('error');
      });
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const progressPercent =
    phase === 'counting'
      ? ((CALIBRATION_DURATION_S - secondsLeft) / CALIBRATION_DURATION_S) * 100
      : ['done', 'calculating', 'uploading'].includes(phase) ? 100 : 0;

  const formatTime = (s: number) => {
    const m   = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Baseline Kalibrasyonu</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Açıklama kartı */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={22} color={Colors.primaryGradientStart} />
          <Text style={styles.infoText}>
            Bu işlem kişisel dinlenme baseline'ınızı oluşturur.{'\n'}
            Oturun, sakin olun ve <Text style={styles.bold}>90 saniye</Text> boyunca hareketsiz bekleyin.
          </Text>
        </View>

        {/* BLE durumu */}
        <View style={[styles.statusRow, isConnected ? styles.statusOk : styles.statusBad]}>
          <Ionicons
            name={isConnected ? 'bluetooth' : 'bluetooth-outline'}
            size={18}
            color={isConnected ? Colors.success : Colors.error}
          />
          <Text style={[styles.statusText, { color: isConnected ? Colors.success : Colors.error }]}>
            {isConnected ? 'Sensör bağlı' : 'Sensör bağlı değil'}
          </Text>
        </View>

        {/* ─── IDLE ─── */}
        {phase === 'idle' && (
          <View style={styles.centerBlock}>
            <View style={styles.iconCircle}>
              <Ionicons name="timer-outline" size={56} color={Colors.primaryGradientStart} />
            </View>
            <Text style={styles.bigLabel}>Hazır mısınız?</Text>
            <Text style={styles.subLabel}>
              Başlat'a basın ve 90 saniye boyunca{'\n'}rahat bir şekilde oturun.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, !isConnected && styles.disabledBtn]}
              onPress={startCalibration}
              disabled={!isConnected}
            >
              <Ionicons name="play" size={20} color={Colors.white} />
              <Text style={styles.primaryBtnText}>Kalibrasyonu Başlat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── COUNTING ─── */}
        {phase === 'counting' && (
          <View style={styles.centerBlock}>
            <View style={styles.timerCircle}>
              <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
              <Text style={styles.timerSubText}>kaldı</Text>
            </View>

            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` as any }]} />
            </View>

            <View style={styles.sampleRow}>
              <Ionicons name="pulse-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.sampleText}>{sampleCount} paket toplandı</Text>
            </View>

            <View style={styles.instructionBox}>
              <Text style={styles.instructionText}>
                🧘 Sakin olun, hareket etmeyin.{'\n'}
                Nefes alırken omuzlarınızı indirin.
              </Text>
            </View>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => {
              clearInterval(timerRef.current!);
              setPhase('idle');
            }}>
              <Text style={styles.secondaryBtnText}>İptal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── CALCULATING / UPLOADING ─── */}
        {(phase === 'calculating' || phase === 'uploading') && (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={Colors.primaryGradientStart} />
            <Text style={[styles.bigLabel, { marginTop: 20 }]}>
              {phase === 'calculating' ? 'Hesaplanıyor…' : 'Kaydediliyor…'}
            </Text>
          </View>
        )}

        {/* ─── DONE ─── */}
        {phase === 'done' && (
          <View style={styles.centerBlock}>
            <View style={[styles.iconCircle, styles.iconSuccess]}>
              <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
            </View>
            <Text style={styles.bigLabel}>Kalibrasyon Tamamlandı!</Text>
            <Text style={styles.subLabel}>
              Kişisel baseline'ınız kaydedildi.
              {nSessionsAfter !== null ? `\nToplam oturum: ${nSessionsAfter}` : ''}
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>Tamam</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPhase('idle')}>
              <Text style={styles.secondaryBtnText}>Tekrar Kalibre Et</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── ERROR ─── */}
        {phase === 'error' && (
          <View style={styles.centerBlock}>
            <View style={[styles.iconCircle, styles.iconError]}>
              <Ionicons name="alert-circle" size={64} color={Colors.error} />
            </View>
            <Text style={styles.bigLabel}>Kalibrasyon Başarısız</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setPhase('idle')}>
              <Text style={styles.primaryBtnText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Stiller ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusOk: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  statusBad: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.error,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconSuccess: {
    backgroundColor: Colors.successLight,
  },
  iconError: {
    backgroundColor: Colors.errorLight,
  },
  bigLabel: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  subLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  timerCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: Colors.primaryGradientStart,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
  },
  timerText: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.primaryGradientStart,
  },
  timerSubText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  progressBg: {
    width: '100%',
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primaryGradientStart,
    borderRadius: 4,
  },
  sampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  instructionBox: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
  },
  instructionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryGradientStart,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
  },
  disabledBtn: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
});
