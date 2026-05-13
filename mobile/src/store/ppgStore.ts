import { create } from 'zustand';

// ─── Tipler ──────────────────────────────────────────────────

export type StressLevel = 'relaxed' | 'moderate' | 'high';
export type BleConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * ESP32'den BLE üzerinden gelen JSON paketinin yapısı.
 * Örnek: {"stress_score": 72, "hr": 85, "hrv": 32, "status": "moderate"}
 */
export interface SensorResult {
  stress_score: number;   // 0–100
  hr: number;             // bpm
  hrv: number;            // RMSSD ms
  status: StressLevel;    // "relaxed" | "moderate" | "high"
  timestamp: number;      // ms epoch (cihaz zamanı veya alım zamanı)
}

export interface PpgState {
  // BLE bağlantı durumu
  bleState: BleConnectionState;
  connectedDeviceId: string | null;
  connectedDeviceName: string | null;

  // Son sensör okuması (ESP32'den gelen işlenmiş sonuç)
  latestResult: SensorResult | null;

  // Kısa geçmiş — grafik veya trend için (son 20 okuma)
  resultHistory: SensorResult[];

  // Actions
  setBleState: (state: BleConnectionState) => void;
  setConnectedDevice: (id: string | null, name: string | null) => void;
  pushResult: (result: SensorResult) => void;
  resetSession: () => void;
}

const HISTORY_MAX = 20;

export const usePpgStore = create<PpgState>((set) => ({
  bleState: 'disconnected',
  connectedDeviceId: null,
  connectedDeviceName: null,
  latestResult: null,
  resultHistory: [],

  setBleState: (state) => set({ bleState: state }),

  setConnectedDevice: (id, name) =>
    set({ connectedDeviceId: id, connectedDeviceName: name }),

  /**
   * ESP32'den gelen her yeni JSON sonucunu kaydeder.
   * resultHistory'yi son HISTORY_MAX kayıtla sınırlar.
   */
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

  resetSession: () =>
    set({
      latestResult: null,
      resultHistory: [],
    }),
}));
