import { create } from 'zustand';

// ─── Tipler ──────────────────────────────────────────────────

export type StressLevel = 'relaxed' | 'moderate' | 'high';
export type MlErrorType = 'no_baseline' | 'backend_error' | 'network_error' | null;
export type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

export interface SensorResult {
  stress_score: number;
  hr: number;
  hrv: number;
  status: StressLevel;
  timestamp: number;
  sdnn?: number;
  mean_nn?: number;
  motion?: number;
  source?: string;
}

export interface MlResult {
  p_stress:     number;
  stress_level: StressLevel;
  stress_score: number;
  session_id:   string;
  analyzed_at:  string;
}

export interface PpgState {
  bleState: BleConnectionState;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;

  latestResult: SensorResult | null;
  latestMlResult: MlResult | null;
  mlLoading: boolean;
  mlError: MlErrorType;
  resultHistory: SensorResult[];

  setBleState: (state: BleConnectionState) => void;
  setConnectedDevice: (id: string | null, name: string | null) => void;
  pushResult: (result: SensorResult) => void;
  setMlResult: (result: MlResult | null) => void;
  setMlLoading: (loading: boolean) => void;
  setMlError: (error: MlErrorType) => void;
  resetSession: () => void;
}

const HISTORY_MAX = 20;

export const usePpgStore = create<PpgState>((set) => ({
  bleState: 'disconnected',
  connectedDeviceId: null,
  connectedDeviceName: null,
  latestResult: null,
  latestMlResult: null,
  mlLoading: false,
  mlError: null,
  resultHistory: [],

  setBleState: (state) => set({ bleState: state }),

  setConnectedDevice: (id, name) =>
    set({ connectedDeviceId: id, connectedDeviceName: name }),

  pushResult: (result) =>
    set((s) => {
      const next = [...s.resultHistory, result];
      return {
        latestResult: result,
        resultHistory: next.length > HISTORY_MAX
          ? next.slice(next.length - HISTORY_MAX)
          : next,
      };
    }),

  setMlResult:  (result)  => set({ latestMlResult: result, mlLoading: false, mlError: null }),
  setMlLoading: (loading) => set({ mlLoading: loading }),
  setMlError:   (error)   => set({ mlError: error, mlLoading: false }),

  resetSession: () =>
    set({
      latestResult: null,
      latestMlResult: null,
      mlLoading: false,
      mlError: null,
      resultHistory: [],
    }),
}));
