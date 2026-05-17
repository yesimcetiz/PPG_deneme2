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
import { ppgApi, ApiError } from './api';

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

/**
 * BLE paketini Railway ML pipeline'ına gönderir.
 * Baseline yoksa (428) sessizce geçer — kullanıcı uyarısı Dashboard'dan gelir.
 */
async function sendToMlPipeline(result: SensorResult): Promise<void> {
  const store = usePpgStore.getState();

  // Firmware v1 fallback: sdnn/mean_nn yoksa türet
  const sdnn    = result.sdnn    ?? result.hrv * 1.15;
  const mean_nn = result.mean_nn ?? (60000 / result.hr);
  const motion  = result.motion  ?? 0.01;

  store.setMlLoading(true);
  try {
    const ml = await ppgApi.analyzeBleMl({
      hr:      result.hr,
      rmssd:   result.hrv,
      sdnn,
      mean_nn,
      motion,
    });
    store.setMlResult({
      p_stress:     ml.p_stress,
      stress_level: ml.stress_level,
      stress_score: ml.stress_score,
      session_id:   ml.session_id,
      analyzed_at:  ml.analyzed_at,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 428) {
        // Baseline yok → store'a işaretle, Dashboard doğru mesajı gösterir
        store.setMlError('no_baseline');
      } else {
        // Diğer backend hataları (422 model yüklenemedi, 500 vb.)
        store.setMlError('backend_error');
        console.warn('[ML Pipeline] Backend hatası:', err.status, err.detail);
      }
    } else {
      store.setMlError('network_error');
      console.warn('[ML Pipeline] Ağ hatası:', err);
    }
    store.setMlLoading(false);
  }
}

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

    // Zorunlu alan doğrulaması
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
      // Firmware v2+ opsiyonel alanlar — varsa al, yoksa undefined kalır
      sdnn:         typeof data.sdnn     === 'number' ? data.sdnn     : undefined,
      mean_nn:      typeof data.mean_nn  === 'number' ? data.mean_nn  : undefined,
      motion:       typeof data.motion   === 'number' ? data.motion   : undefined,
      source:       typeof data.source   === 'string' ? data.source   : undefined,
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
  console.log('[BLE] discoverAllServicesAndCharacteristics başlıyor...');
  await device.discoverAllServicesAndCharacteristics();
  console.log('[BLE] Servisler keşfedildi. Notification subscription kuruluyor...');

  notifySub = device.monitorCharacteristicForService(
    STRESS_SERVICE_UUID,
    STRESS_CHAR_UUID,
    (error: BleError | null, characteristic) => {
      if (error) {
        console.error('[BLE] Notification hatası — bağlantı kesiliyor:', error.message, 'errorCode:', error.errorCode);
        handleDisconnect();
        return;
      }
      if (!characteristic?.value) {
        console.warn('[BLE] Boş karakteristik değeri geldi, atlanıyor.');
        return;
      }

      console.log('[BLE] Paket alındı, parse ediliyor...');
      const result = parseCharacteristicValue(characteristic.value);
      if (result) {
        console.log(`[BLE] Parse OK → HR=${result.hr} HRV=${result.hrv} score=${result.stress_score}`);
        usePpgStore.getState().pushResult(result);
        sendToMlPipeline(result);
      } else {
        console.warn('[BLE] Parse başarısız — JSON formatı hatalı veya zorunlu alan eksik.');
      }
    },
  );
  console.log('[BLE] Notification subscription kuruldu ✓');
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
    console.log(`[BLE] Bağlanılıyor: ${deviceId} | Platform: ${Platform.OS}`);

    const device = await manager.connectToDevice(deviceId, {
      autoConnect: false,
      requestMTU: Platform.OS === 'android' ? 185 : undefined,
    });

    console.log(`[BLE] Bağlandı: id=${device.id} name=${device.name ?? device.localName ?? '?'}`);
    connectedDevice = device;
    store.setConnectedDevice(device.id, device.name ?? device.localName ?? 'Stress Sensor');
    store.setBleState('connected');
    store.resetSession();

    await subscribeToResults(device);
    device.onDisconnected(() => {
      console.warn('[BLE] Cihaz bağlantısı kesildi — yeniden bağlanılacak.');
      handleDisconnect(true);
    });
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
