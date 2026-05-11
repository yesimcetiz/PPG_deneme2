import { create } from 'zustand';

// ─── Enums & Types ───────────────────────────────────────────

export type StressLevel = 'relaxed' | 'moderate' | 'high';
export type BleConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error';

export interface PpgSample {
  value: number;     // raw ADC / normalized 0–1
  timestamp: number; // ms epoch
}

export interface PpgAnalysisResult {
  session_id: string;
  heart_rate: number;          // bpm
  hrv_rmssd: number;           // ms
  stress_level: StressLevel;
  stress_score: number;        // 0–100
  confidence: number;          // 0–1
  analyzed_at: string;         // ISO timestamp
}

export interface PpgState {
  // BLE hardware
  bleState: BleConnectionState;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;

  // Streaming data (ring buffer, max 200 samples for chart)
  ppgBuffer: PpgSample[];
  bufferMaxSize: number;

  // Derived metrics (updated after each /ppg/analyze response)
  heartRate: number | null;
  hrvRmssd: number | null;
  stressLevel: StressLevel | null;
  stressScore: number | null;
  latestResult: PpgAnalysisResult | null;

  // Streaming accumulator sent to backend in batches
  pendingSamples: PpgSample[];

  // Actions
  setBleState: (state: BleConnectionState) => void;
  setConnectedDevice: (id: string | null, name: string | null) => void;
  pushSample: (sample: PpgSample) => void;
  flushPendingSamples: () => PpgSample[];
  setAnalysisResult: (result: PpgAnalysisResult) => void;
  resetSession: () => void;
}

const BUFFER_MAX = 200;

export const usePpgStore = create<PpgState>((set, get) => ({
  // Initial hardware state
  bleState: 'disconnected',
  connectedDeviceId: null,
  connectedDeviceName: null,

  // Initial data
  ppgBuffer: [],
  bufferMaxSize: BUFFER_MAX,
  heartRate: null,
  hrvRmssd: null,
  stressLevel: null,
  stressScore: null,
  latestResult: null,
  pendingSamples: [],

  // ── BLE actions ──────────────────────────────────────────
  setBleState: (state) => set({ bleState: state }),

  setConnectedDevice: (id, name) =>
    set({ connectedDeviceId: id, connectedDeviceName: name }),

  // ── Data actions ─────────────────────────────────────────
  pushSample: (sample) =>
    set((s) => {
      // Ring buffer: keep only the latest BUFFER_MAX samples
      const next = [...s.ppgBuffer, sample];
      const trimmed = next.length > BUFFER_MAX ? next.slice(next.length - BUFFER_MAX) : next;
      return {
        ppgBuffer: trimmed,
        pendingSamples: [...s.pendingSamples, sample],
      };
    }),

  // Returns and clears the pending accumulator (called by HardwareService before API post)
  flushPendingSamples: () => {
    const { pendingSamples } = get();
    set({ pendingSamples: [] });
    return pendingSamples;
  },

  setAnalysisResult: (result) =>
    set({
      heartRate: result.heart_rate,
      hrvRmssd: result.hrv_rmssd,
      stressLevel: result.stress_level,
      stressScore: result.stress_score,
      latestResult: result,
    }),

  resetSession: () =>
    set({
      ppgBuffer: [],
      pendingSamples: [],
      heartRate: null,
      hrvRmssd: null,
      stressLevel: null,
      stressScore: null,
      latestResult: null,
    }),
}));
