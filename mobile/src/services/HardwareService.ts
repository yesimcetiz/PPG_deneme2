/**
 * HardwareService.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Manages BLE communication with the ESP32/Arduino PPG sensor device.
 *
 * Architecture:
 *  • Uses react-native-ble-plx for low-level BLE (Expo-compatible via
 *    expo-dev-client / bare workflow or EAS build with config plugin).
 *  • Incoming GATT notifications are decoded from Base64 → Float32 samples.
 *  • Samples are pushed into ppgStore (ring buffer, max 200 pts).
 *  • Every BATCH_INTERVAL_MS, pending samples are flushed and POSTed to
 *    /ppg/analyze.  The ML result is written back into ppgStore.
 *  • All BLE state transitions are reflected in ppgStore.bleState so the UI
 *    can render accurate connection status without any internal state.
 *
 * Security note:
 *  • Raw health payloads are never written to console in production builds.
 *  • Device ID and session identifiers are treated as opaque strings.
 *
 * Usage:
 *   import HardwareService from './HardwareService';
 *   await HardwareService.startScan();
 *   await HardwareService.connect(deviceId);
 *   HardwareService.disconnect();
 */

import { BleManager, Device, Subscription, BleError } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { usePpgStore, PpgSample } from '../store/ppgStore';
import { ppgApi } from './api';

// ─── ESP32 GATT UUIDs ────────────────────────────────────────────────────────
// Replace with the actual UUIDs programmed into your ESP32 firmware.
const PPG_SERVICE_UUID      = '12345678-1234-1234-1234-1234567890ab';
const PPG_CHAR_UUID         = '12345678-1234-1234-1234-1234567890cd';

// ─── Tuning constants ────────────────────────────────────────────────────────
const SCAN_TIMEOUT_MS       = 15_000;   // stop scanning after 15 s
const BATCH_INTERVAL_MS     = 5_000;    // send batch to backend every 5 s
const SAMPLE_RATE_HZ        = 100;      // must match ESP32 firmware
const RECONNECT_DELAY_MS    = 3_000;    // wait before auto-reconnect attempt
const MAX_RECONNECT_ATTEMPTS = 3;

// ─── Module-level state (NOT stored in React state — avoids GC issues) ──────
let bleManager: BleManager | null = null;
let scanSubscription: Subscription | null = null;
let notifySubscription: Subscription | null = null;
let batchTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectedDevice: Device | null = null;
let reconnectAttempts = 0;
let isServiceActive = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getManager(): BleManager {
  if (!bleManager) {
    bleManager = new BleManager();
  }
  return bleManager;
}

/**
 * Decode a Base64-encoded BLE characteristic value.
 * The ESP32 firmware packs each PPG sample as a little-endian IEEE 754 float.
 * Multiple samples can be packed in one notification (up to MTU ÷ 4).
 */
function decodeCharacteristicValue(base64: string): number[] {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const floatView = new Float32Array(bytes.buffer);
    return Array.from(floatView);
  } catch {
    return [];
  }
}

/** Normalise a raw 12-bit ADC reading (0–4095) to 0–1. */
function normalizeAdcValue(raw: number): number {
  return Math.min(Math.max(raw / 4095, 0), 1);
}

// ─── Batch flush ─────────────────────────────────────────────────────────────

async function flushBatch(): Promise<void> {
  if (!connectedDevice) return;

  const store = usePpgStore.getState();
  const samples = store.flushPendingSamples();

  if (samples.length === 0) return;

  try {
    const response = await ppgApi.analyze({
      samples,
      device_id: connectedDevice.id,
      sample_rate_hz: SAMPLE_RATE_HZ,
    });
    store.setAnalysisResult(response);
  } catch {
    // Silent — UI will show last known values; don't expose health data in logs
  }
}

// ─── Notification handler ────────────────────────────────────────────────────

function handleNotification(base64Value: string | null): void {
  if (!base64Value) return;

  const rawValues = decodeCharacteristicValue(base64Value);
  const now = Date.now();
  const store = usePpgStore.getState();

  rawValues.forEach((raw, i) => {
    const sample: PpgSample = {
      value: normalizeAdcValue(raw),
      timestamp: now + i, // micro-offset so timestamps are strictly monotonic
    };
    store.pushSample(sample);
  });
}

// ─── BLE subscription ────────────────────────────────────────────────────────

async function subscribeToNotifications(device: Device): Promise<void> {
  // Ensure services/characteristics are discovered
  await device.discoverAllServicesAndCharacteristics();

  notifySubscription = device.monitorCharacteristicForService(
    PPG_SERVICE_UUID,
    PPG_CHAR_UUID,
    (error: BleError | null, characteristic) => {
      if (error) {
        // Device dropped connection
        handleDisconnect();
        return;
      }
      if (characteristic?.value) {
        handleNotification(characteristic.value);
      }
    },
  );
}

// ─── Disconnect / cleanup ────────────────────────────────────────────────────

function clearTimers(): void {
  if (batchTimer)      { clearInterval(batchTimer);   batchTimer = null; }
  if (reconnectTimer)  { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (scanSubscription){ scanSubscription.remove();    scanSubscription = null; }
  if (notifySubscription){ notifySubscription.remove(); notifySubscription = null; }
}

function handleDisconnect(shouldReconnect = true): void {
  const store = usePpgStore.getState();
  clearTimers();
  connectedDevice = null;
  store.setConnectedDevice(null, null);
  store.setBleState('disconnected');

  if (shouldReconnect && isServiceActive && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
    reconnectAttempts++;
    store.setBleState('scanning');
    reconnectTimer = setTimeout(() => {
      HardwareService.startScan();
    }, RECONNECT_DELAY_MS);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

const HardwareService = {
  /**
   * Request BLE permissions and begin scanning for PPG devices.
   * On iOS, BleManager handles the CoreBluetooth permission dialog.
   * On Android, you must declare ACCESS_FINE_LOCATION + BLUETOOTH_SCAN in
   * app.json's expo.android.permissions array.
   */
  async startScan(): Promise<void> {
    isServiceActive = true;
    reconnectAttempts = 0;
    const manager = getManager();
    const store = usePpgStore.getState();

    // Wait for BLE adapter to be powered on
    await new Promise<void>((resolve, reject) => {
      const sub = manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          sub.remove();
          resolve();
        }
        if (state === 'Unsupported' || state === 'Unauthorized') {
          sub.remove();
          reject(new Error(`BLE state: ${state}`));
        }
      }, true);
    });

    store.setBleState('scanning');

    // Auto-stop scan after timeout
    const scanTimeout = setTimeout(() => {
      manager.stopDeviceScan();
      if (!connectedDevice) {
        store.setBleState('disconnected');
      }
    }, SCAN_TIMEOUT_MS);

    scanSubscription = {
      remove: () => {
        clearTimeout(scanTimeout);
        manager.stopDeviceScan();
      },
    } as Subscription;

    manager.startDeviceScan(
      [PPG_SERVICE_UUID],
      { allowDuplicates: false },
      async (error, device) => {
        if (error || !device) return;

        // Connect to the first matching device found
        manager.stopDeviceScan();
        clearTimeout(scanTimeout);

        try {
          await HardwareService.connect(device.id);
        } catch {
          store.setBleState('error');
        }
      },
    );
  },

  /**
   * Connect to a known device by ID (e.g. from a device picker UI).
   */
  async connect(deviceId: string): Promise<void> {
    const manager = getManager();
    const store = usePpgStore.getState();

    store.setBleState('connecting');

    try {
      const device = await manager.connectToDevice(deviceId, {
        autoConnect: false,
        requestMTU: Platform.OS === 'android' ? 512 : undefined,
      });

      connectedDevice = device;
      store.setConnectedDevice(device.id, device.name ?? device.localName ?? 'PPG Sensor');
      store.setBleState('connected');
      store.resetSession();

      // Subscribe to PPG characteristic notifications
      await subscribeToNotifications(device);

      // Listen for unexpected disconnection
      device.onDisconnected(() => handleDisconnect(true));

      // Start batch flush timer
      batchTimer = setInterval(flushBatch, BATCH_INTERVAL_MS);
    } catch (err) {
      store.setBleState('error');
      connectedDevice = null;
      throw err;
    }
  },

  /**
   * Gracefully disconnect, flush any remaining samples, and stop timers.
   */
  async disconnect(): Promise<void> {
    isServiceActive = false;
    await flushBatch(); // send last partial batch before disconnecting
    clearTimers();

    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
      } catch {
        // Already disconnected — safe to ignore
      }
    }

    handleDisconnect(false);
  },

  /**
   * Destroy the BleManager completely (call in app teardown / useEffect cleanup).
   */
  destroy(): void {
    isServiceActive = false;
    clearTimers();
    bleManager?.destroy();
    bleManager = null;
  },

  /** Returns the currently connected device ID (or null). */
  getConnectedDeviceId(): string | null {
    return connectedDevice?.id ?? null;
  },
};

export default HardwareService;
