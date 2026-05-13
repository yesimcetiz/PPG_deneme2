/**
 * HardwareService.ts — Scenario B (Edge AI)
 * ──────────────────────────────────────────────────────────────────────────
 * ESP32, TinyML modelini kendi üzerinde çalıştırır ve sadece işlenmiş
 * sonucu JSON olarak BLE karakteristiğinden yayınlar:
 *
 *   {"stress_score": 72, "hr": 85, "hrv": 32, "status": "moderate"}
 *
 * Bu servis:
 *  1. BLE ile ESP32'yi tarar ve bağlanır
 *  2. JSON karakteristiğini dinler
 *  3. Gelen her paketi parse edip ppgStore'a yazar
 *  4. (Opsiyonel) Backend'e kayıt için ppgApi.logResult() çağırır
 *
 * Ham PPG tamponu veya HRV hesabı YOKTUR — bunlar artık ESP32'de yapılır.
 */

import { BleManager, Device, Subscription, BleError } from 'react-native-ble-plx';
import { Platform } from 'react-native';
import { usePpgStore, SensorResult, StressLevel } from '../store/ppgStore';

// ─── ESP32 GATT UUID'leri ────────────────────────────────────
// Firmware'ınızdaki gerçek UUID'lerle değiştirin.
const STRESS_SERVICE_UUID  = '12345678-1234-1234-1234-1234567890ab';
const STRESS_CHAR_UUID     = '12345678-1234-1234-1234-1234567890ef'; // JSON sonuç

// ─── Ayarlar ─────────────────────────────────────────────────
const SCAN_TIMEOUT_MS      = 15_000;
const RECONNECT_DELAY_MS   = 3_000;
const MAX_RECONNECT        = 3;

// ─── Modül seviyesi durum ────────────────────────────────────
let bleManager:        BleManager | null = null;
let scanSub:           Subscription | null = null;
let notifySub:         Subscription | null = null;
let reconnectTimer:    ReturnType<typeof setTimeout> | null = null;
let connectedDevice:   Device | null = null;
let reconnectAttempts  = 0;
let isActive           = false;

// ─── Yardımcı fonksiyonlar ───────────────────────────────────

function getManager(): BleManager {
  if (!bleManager) bleManager = new BleManager();
  return bleManager;
}

/**
 * Base64 kodlu BLE değerini UTF-8 string'e çevirir,
 * JSON olarak parse eder ve SensorResult döner.
 */
function parseCharacteristicValue(base64: string): SensorResult | null {
  try {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder('utf-8').decode(bytes);
    const data = JSON.parse(json);

    // Alan doğrulaması
    if (
      typeof data.stress_score !== 'number' ||
      typeof data.hr           !== 'number' ||
      typeof data.hrv          !== 'number' ||
      typeof data.status       !== 'string'
    ) {
      return null;
    }

    const validStatuses: StressLevel[] = ['relaxed', 'moderate', 'high'];
    const status: StressLevel = validStatuses.includes(data.status)
      ? data.status
      : 'moderate';

    return {
      stress_score: Math.round(data.stress_score),
      hr:           Math.round(data.hr),
      hrv:          Math.round(data.hrv),
      status,
      timestamp:    Date.now(),
    };
  } catch {
    return null; // JSON parse hatası — paketi yoksay
  }
}

// ─── Bağlantı yönetimi ───────────────────────────────────────

function clearTimers() {
  if (scanSub)       { scanSub.remove();       scanSub       = null; }
  if (notifySub)     { notifySub.remove();      notifySub     = null; }
  if (reconnectTimer){ clearTimeout(reconnectTimer); reconnectTimer = null; }
}

function handleDisconnect(shouldReconnect = true) {
  const store = usePpgStore.getState();
  clearTimers();
  connectedDevice = null;
  store.setConnectedDevice(null, null);
  store.setBleState('disconnected');

  if (shouldReconnect && isActive && reconnectAttempts < MAX_RECONNECT) {
    reconnectAttempts++;
    store.setBleState('scanning');
    reconnectTimer = setTimeout(() => HardwareService.startScan(), RECONNECT_DELAY_MS);
  }
}

async function subscribeToResults(device: Device) {
  await device.discoverAllServicesAndCharacteristics();

  notifySub = device.monitorCharacteristicForService(
    STRESS_SERVICE_UUID,
    STRESS_CHAR_UUID,
    (error: BleError | null, characteristic) => {
      if (error) {
        handleDisconnect();
        return;
      }
      if (!characteristic?.value) return;

      const result = parseCharacteristicValue(characteristic.value);
      if (result) {
        usePpgStore.getState().pushResult(result);
      }
    },
  );
}

// ─── Public API ──────────────────────────────────────────────

const HardwareService = {
  async startScan(): Promise<void> {
    isActive = true;
    reconnectAttempts = 0;
    const manager = getManager();
    const store   = usePpgStore.getState();

    // BLE adaptörünün açılmasını bekle
    await new Promise<void>((resolve, reject) => {
      const sub = manager.onStateChange((state) => {
        if (state === 'PoweredOn') { sub.remove(); resolve(); }
        if (state === 'Unsupported' || state === 'Unauthorized') {
          sub.remove();
          reject(new Error(`BLE durumu: ${state}`));
        }
      }, true);
    });

    store.setBleState('scanning');

    const timeout = setTimeout(() => {
      manager.stopDeviceScan();
      if (!connectedDevice) store.setBleState('disconnected');
    }, SCAN_TIMEOUT_MS);

    scanSub = { remove: () => { clearTimeout(timeout); manager.stopDeviceScan(); } } as Subscription;

    manager.startDeviceScan(
      [STRESS_SERVICE_UUID],
      { allowDuplicates: false },
      async (error, device) => {
        if (error || !device) return;
        manager.stopDeviceScan();
        clearTimeout(timeout);
        try {
          await HardwareService.connect(device.id);
        } catch {
          store.setBleState('error');
        }
      },
    );
  },

  async connect(deviceId: string): Promise<void> {
    const manager = getManager();
    const store   = usePpgStore.getState();

    store.setBleState('connecting');

    const device = await manager.connectToDevice(deviceId, {
      autoConnect: false,
      requestMTU: Platform.OS === 'android' ? 185 : undefined, // JSON için yeterli MTU
    });

    connectedDevice = device;
    store.setConnectedDevice(device.id, device.name ?? device.localName ?? 'Stress Sensor');
    store.setBleState('connected');
    store.resetSession();

    await subscribeToResults(device);
    device.onDisconnected(() => handleDisconnect(true));
  },

  async disconnect(): Promise<void> {
    isActive = false;
    clearTimers();
    if (connectedDevice) {
      try { await connectedDevice.cancelConnection(); } catch { /* ignore */ }
    }
    handleDisconnect(false);
  },

  destroy(): void {
    isActive = false;
    clearTimers();
    bleManager?.destroy();
    bleManager = null;
  },

  getConnectedDeviceId(): string | null {
    return connectedDevice?.id ?? null;
  },
};

export default HardwareService;
