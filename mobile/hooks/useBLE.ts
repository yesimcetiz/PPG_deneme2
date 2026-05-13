/**
 * useBLE.ts — Scenario B (Edge AI)
 * React hook olarak BLE bağlantısını yönetir.
 *
 * ESP32 TinyML modelini kendi üzerinde çalıştırır ve JSON gönderir:
 *   {"stress_score": 72, "hr": 85, "hrv": 32, "status": "moderate"}
 */

import { useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { usePpgStore, SensorResult, StressLevel } from '../src/store/ppgStore';

// ─── UUID'ler — Firmware'ınızdaki gerçek UUID'lerle değiştirin ─
const STRESS_SERVICE_UUID = '12345678-1234-1234-1234-1234567890ab';
const STRESS_CHAR_UUID    = '12345678-1234-1234-1234-1234567890ef';

const bleManager = new BleManager();

function parseResult(base64: string): SensorResult | null {
  try {
    const binary = atob(base64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const data = JSON.parse(new TextDecoder('utf-8').decode(bytes));

    if (
      typeof data.stress_score !== 'number' ||
      typeof data.hr           !== 'number' ||
      typeof data.hrv          !== 'number' ||
      typeof data.status       !== 'string'
    ) return null;

    const valid: StressLevel[] = ['relaxed', 'moderate', 'high'];
    return {
      stress_score: Math.round(data.stress_score),
      hr:           Math.round(data.hr),
      hrv:          Math.round(data.hrv),
      status:       valid.includes(data.status) ? data.status : 'moderate',
      timestamp:    Date.now(),
    };
  } catch { return null; }
}

export const useBLE = () => {
  const setBleState        = usePpgStore((s) => s.setBleState);
  const setConnectedDevice = usePpgStore((s) => s.setConnectedDevice);
  const pushResult         = usePpgStore((s) => s.pushResult);
  const resetSession       = usePpgStore((s) => s.resetSession);

  const [isScanning,        setIsScanning]          = useState(false);
  const [discoveredDevices, setDiscoveredDevices]    = useState<Device[]>([]);
  const [connectedDevice,   setConnectedDeviceLocal] = useState<Device | null>(null);

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(granted).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  };

  const scanForDevices = async () => {
    if (!(await requestPermissions())) return;
    setIsScanning(true);
    setBleState('scanning');
    setDiscoveredDevices([]);

    bleManager.startDeviceScan(
      [STRESS_SERVICE_UUID],
      { allowDuplicates: false },
      (_err, device) => {
        if (device?.name) {
          setDiscoveredDevices((prev) =>
            prev.find((d) => d.id === device.id) ? prev : [...prev, device]
          );
        }
      }
    );
    setTimeout(stopScan, 10_000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setIsScanning(false);
    if (usePpgStore.getState().bleState === 'scanning') setBleState('disconnected');
  };

  const connectToDevice = async (device: Device) => {
    try {
      stopScan();
      setBleState('connecting');
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();

      setConnectedDeviceLocal(connected);
      setConnectedDevice(connected.id, connected.name ?? 'PPG Sensör');
      setBleState('connected');
      resetSession();

      connected.monitorCharacteristicForService(
        STRESS_SERVICE_UUID, STRESS_CHAR_UUID,
        (error, char) => {
          if (error) { handleDisconnect(); return; }
          if (char?.value) {
            const result = parseResult(char.value);
            if (result) pushResult(result);
          }
        }
      );
      connected.onDisconnected(() => handleDisconnect());
    } catch { setBleState('error'); }
  };

  const disconnectFromDevice = async () => {
    try { await connectedDevice?.cancelConnection(); } catch { /* ignore */ }
    handleDisconnect();
  };

  const handleDisconnect = () => {
    setConnectedDeviceLocal(null);
    setConnectedDevice(null, null);
    setBleState('disconnected');
  };

  return { scanForDevices, stopScan, isScanning, discoveredDevices, connectToDevice, disconnectFromDevice, connectedDevice };
};
