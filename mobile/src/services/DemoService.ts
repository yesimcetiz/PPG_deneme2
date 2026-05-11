/**
 * DemoService.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Gerçek PPG donanımı olmadan Dashboard'u test etmek için
 * gerçekçi sahte sinyal üretir.
 *
 * PPG dalga formu: Temel sinüs + küçük harmonik + rastgele gürültü
 * HR: 60–90 bpm arası yavaşça değişir
 * Stres seviyesi: ~30 saniyede bir rastgele değişir
 */

import { usePpgStore, PpgSample, StressLevel } from '../store/ppgStore';

// ─── Sabitler ────────────────────────────────────────────────

const TICK_INTERVAL_MS   = 10;   // 100 Hz simülasyon
const STRESS_CYCLE_MS    = 30_000; // 30 sn'de bir stres değişimi
const BATCH_INTERVAL_MS  = 5_000;  // 5 sn'de bir "analiz" sonucu

// ─── Modül düzeyinde durum ────────────────────────────────────

let tickTimer:   ReturnType<typeof setInterval> | null = null;
let stressTimer: ReturnType<typeof setInterval> | null = null;
let batchTimer:  ReturnType<typeof setInterval> | null = null;
let phase = 0;         // sinüs faz açısı (radyan)
let baseHR  = 72;      // anlık simüle kalp hızı (bpm)
let targetHR = 72;
let isActive = false;

// ─── Sinyal üreteci ───────────────────────────────────────────

/**
 * Gerçekçi PPG dalgası:
 *   sistol tepesi (dar) + diyakrotik çentik + diyastol çöküşü
 */
function ppgWaveform(phase: number): number {
  // Normalized 0–2π period
  const t = ((phase % (2 * Math.PI)) / (2 * Math.PI));

  // Ana sistol tepesi
  const systole = Math.exp(-Math.pow((t - 0.2) / 0.07, 2));
  // Diyakrotik çentik (daha küçük ikinci tepe)
  const dicrotic = 0.3 * Math.exp(-Math.pow((t - 0.55) / 0.05, 2));
  // Bazal drift
  const drift = 0.05 * Math.sin(2 * Math.PI * t);
  // Gürültü
  const noise = (Math.random() - 0.5) * 0.04;

  return Math.min(Math.max(systole + dicrotic + drift + noise, 0), 1);
}

// ─── Anlık metrikleri hesapla ─────────────────────────────────

function computeSimulatedMetrics(stressLevel: StressLevel): {
  heartRate: number;
  hrvRmssd: number;
  stressScore: number;
} {
  const hr = baseHR;
  let hrv: number;
  let score: number;

  switch (stressLevel) {
    case 'relaxed':
      hrv   = 55 + Math.random() * 20;  // 55–75 ms
      score = Math.round(10 + Math.random() * 25);
      break;
    case 'moderate':
      hrv   = 30 + Math.random() * 20;  // 30–50 ms
      score = Math.round(40 + Math.random() * 25);
      break;
    case 'high':
      hrv   = 10 + Math.random() * 18;  // 10–28 ms
      score = Math.round(70 + Math.random() * 25);
      break;
  }

  return { heartRate: hr, hrvRmssd: hrv, stressScore: Math.min(score, 99) };
}

// ─── Public API ───────────────────────────────────────────────

const STRESS_SEQUENCE: StressLevel[] = ['relaxed', 'relaxed', 'moderate', 'high', 'moderate', 'relaxed'];
let stressIdx = 0;

const DemoService = {
  isRunning(): boolean {
    return isActive;
  },

  start(): void {
    if (isActive) return;
    isActive = true;

    const store = usePpgStore.getState();
    store.setBleState('connected');
    store.setConnectedDevice('DEMO-DEVICE', '🧪 Demo Sensör');
    store.resetSession();

    phase    = 0;
    baseHR   = 72;
    targetHR = 72;
    stressIdx = 0;

    // ── Sinyal tick'i (100 Hz) ────────────────────────────────
    tickTimer = setInterval(() => {
      phase += (2 * Math.PI * baseHR) / 60 / 100; // frekans = HR/60 Hz

      // HR'yi yavaşça target'a yaklaştır (lerp)
      baseHR += (targetHR - baseHR) * 0.001;

      const sample: PpgSample = {
        value:     ppgWaveform(phase),
        timestamp: Date.now(),
      };
      usePpgStore.getState().pushSample(sample);
    }, TICK_INTERVAL_MS);

    // ── Stres döngüsü (30 sn) ────────────────────────────────
    const applyStressChange = () => {
      const stressLevel = STRESS_SEQUENCE[stressIdx % STRESS_SEQUENCE.length];
      stressIdx++;

      // HR'yi strese göre ayarla
      switch (stressLevel) {
        case 'relaxed':  targetHR = 60 + Math.random() * 15; break;
        case 'moderate': targetHR = 75 + Math.random() * 15; break;
        case 'high':     targetHR = 90 + Math.random() * 20; break;
      }
    };

    applyStressChange(); // ilk uygulama hemen
    stressTimer = setInterval(applyStressChange, STRESS_CYCLE_MS);

    // ── Analiz batch'i (5 sn) ────────────────────────────────
    batchTimer = setInterval(() => {
      const level = STRESS_SEQUENCE[(stressIdx - 1) % STRESS_SEQUENCE.length];
      const metrics = computeSimulatedMetrics(level);

      usePpgStore.getState().setAnalysisResult({
        session_id:   `demo-${Date.now()}`,
        heart_rate:   Math.round(metrics.heartRate),
        hrv_rmssd:    Math.round(metrics.hrvRmssd),
        stress_level: level,
        stress_score: metrics.stressScore,
        confidence:   0.85 + Math.random() * 0.1,
        analyzed_at:  new Date().toISOString(),
      });
    }, BATCH_INTERVAL_MS);
  },

  stop(): void {
    if (!isActive) return;
    isActive = false;

    if (tickTimer)   { clearInterval(tickTimer);   tickTimer   = null; }
    if (stressTimer) { clearInterval(stressTimer); stressTimer = null; }
    if (batchTimer)  { clearInterval(batchTimer);  batchTimer  = null; }

    const store = usePpgStore.getState();
    store.setBleState('disconnected');
    store.setConnectedDevice(null, null);
  },
};

export default DemoService;
