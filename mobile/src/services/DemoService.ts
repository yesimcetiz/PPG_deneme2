/**
 * DemoService.ts — Scenario B Demo Modu
 * ──────────────────────────────────────────────────────────────────────────
 * Gerçek ESP32 olmadan uygulama akışını test etmek için:
 * Her 2 saniyede bir gerçekçi JSON sonuç paketi üretir.
 *
 * Yeni mimaride ESP32 TinyML modeli sonuçları üretiyor.
 * Demo modu bunu simüle eder — ham PPG üretmez.
 */

import { usePpgStore, SensorResult, StressLevel } from '../store/ppgStore';

// ─── Sabitler ────────────────────────────────────────────────
const UPDATE_INTERVAL_MS  = 2_000;   // 2 saniyede bir yeni sonuç
const SCENARIO_DURATION   = 30_000;  // 30 sn'de bir senaryo değişir

// ─── Modül seviyesi durum ────────────────────────────────────
let updateTimer:   ReturnType<typeof setInterval> | null = null;
let scenarioTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let scenarioIdx = 0;

// Stres senaryoları: (stresLevel, baseHR, baseHRV, scoreRange)
const SCENARIOS: Array<{
  status: StressLevel;
  hr: [number, number];   // [min, max]
  hrv: [number, number];  // [min, max]
  score: [number, number];// [min, max]
}> = [
  { status: 'relaxed',  hr: [58, 68],  hrv: [55, 80], score: [10, 30] },
  { status: 'moderate', hr: [72, 85],  hrv: [30, 50], score: [40, 65] },
  { status: 'high',     hr: [88, 105], hrv: [10, 28], score: [70, 95] },
  { status: 'moderate', hr: [75, 88],  hrv: [28, 45], score: [45, 68] },
  { status: 'relaxed',  hr: [60, 70],  hrv: [50, 75], score: [12, 28] },
];

function rand(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

function generateResult(): SensorResult {
  const s = SCENARIOS[scenarioIdx % SCENARIOS.length];
  return {
    stress_score: rand(...s.score),
    hr:           rand(...s.hr),
    hrv:          rand(...s.hrv),
    status:       s.status,
    timestamp:    Date.now(),
  };
}

// ─── Public API ──────────────────────────────────────────────

const DemoService = {
  isRunning(): boolean {
    return isRunning;
  },

  start(): void {
    if (isRunning) return;
    isRunning = true;
    scenarioIdx = 0;

    const store = usePpgStore.getState();
    store.setBleState('connected');
    store.setConnectedDevice('DEMO-DEVICE', '🧪 Demo Sensör');
    store.resetSession();

    // İlk sonucu hemen gönder
    store.pushResult(generateResult());

    // Her 2 sn'de yeni sonuç
    updateTimer = setInterval(() => {
      usePpgStore.getState().pushResult(generateResult());
    }, UPDATE_INTERVAL_MS);

    // Her 30 sn'de senaryo değişir
    scenarioTimer = setInterval(() => {
      scenarioIdx++;
    }, SCENARIO_DURATION);
  },

  stop(): void {
    if (!isRunning) return;
    isRunning = false;

    if (updateTimer)   { clearInterval(updateTimer);   updateTimer   = null; }
    if (scenarioTimer) { clearInterval(scenarioTimer); scenarioTimer = null; }

    const store = usePpgStore.getState();
    store.setBleState('disconnected');
    store.setConnectedDevice(null, null);
  },
};

export default DemoService;
