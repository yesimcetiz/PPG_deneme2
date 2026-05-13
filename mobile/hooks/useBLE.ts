import { useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import { usePpgStore } from '../src/store/ppgStore';

// Bluetooth yöneticisini hook dışında tanımlıyoruz ki re-render'larda ölmesin
const bleManager = new BleManager();

export const useBLE = () => {
  // Global Store (ppgStore) bağlantıları
  const setBleState = usePpgStore((state) => state.setBleState);
  const setConnectedDeviceStore = usePpgStore((state) => state.setConnectedDevice);
  const pushSample = usePpgStore((state) => state.pushSample);

  // Local State
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDeviceLocal] = useState<Device | null>(null);

  // 1. İzinleri Kontrol Et (Özellikle Android için kritik)
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(granted).every((res) => res === PermissionsAndroid.RESULTS.GRANTED);
    }
    return true; // iOS için izinler app.json'da halledildi
  };

  // 2. Cihaz Taramayı Başlat
  const scanForDevices = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setIsScanning(true);
    setBleState('scanning');
    setDiscoveredDevices([]);

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error("Tarama hatası:", error);
        setIsScanning(false);
        setBleState('error');
        return;
      }

      // Sadece ismi olan cihazları listeye ekle (Kalabalığı önlemek için)
      if (device && device.name) {
        setDiscoveredDevices((prev: Device[]) => {
          if (!prev.find(d => d.id === device.id)) {
            return [...prev, device];
          }
          return prev;
        });
      }
    });

    // 10 saniye sonra taramayı otomatik durdur
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
      
      // Eğer bir cihaza bağlanılmadıysa state'i boşa çek
      usePpgStore.getState().bleState === 'scanning' && setBleState('disconnected');
    }, 10000);
  };

  // 3. ESP32'ye Bağlan
  const connectToDevice = async (device: Device) => {
    try {
      setBleState('connecting');
      const connected = await device.connect();
      
      setConnectedDeviceLocal(connected);
      setConnectedDeviceStore(connected.id, connected.name);
      
      await connected.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();
      setIsScanning(false);
      setBleState('connected');

      // Veri okumayı (Streaming) başlat
      startStreamingData(connected);
    } catch (e) {
      console.error("Bağlantı hatası:", e);
      setBleState('error');
    }
  };

  // 4. Veri Akışını Dinle (I2C -> ESP32 -> BLE -> App)
  const startStreamingData = (device: Device) => {
    // Burada ESP32 tarafındaki Service ve Characteristic UUID'lerini yazmalısın
    const SERVICE_UUID = "1234...";
    const CHARACTERISTIC_UUID = "5678...";

    device.monitorCharacteristicForService(SERVICE_UUID, CHARACTERISTIC_UUID, (error, char) => {
      if (error) {
        console.error("Veri okuma hatası:", error);
        return;
      }
      
      if (char?.value) {
        try {
          // React Native ortamında atob veya base64 çözücü kullanılmalı. 
          // react-native-ble-plx base64 döndürür, eğer buffer kütüphanesi kuruluysa Buffer kullanabilirsin.
          // const rawData = Buffer.from(char.value, 'base64').toString();
          
          // Şimdilik PPG sensöründen gelen ham datayı sayısallaştırıp pushSample ile ekliyoruz
          // const parsedValue = parseFloat(rawData); 
          
          // pushSample fonksiyonu timestamp de ister
          // pushSample({ value: parsedValue, timestamp: Date.now() });
        } catch (e) {
          console.error("Veri parse hatası:", e);
        }
      }
    });
  };

  const disconnectFromDevice = async () => {
    if (connectedDevice) {
      await connectedDevice.cancelConnection();
      setConnectedDeviceLocal(null);
      setConnectedDeviceStore(null, null);
      setBleState('disconnected');
    }
  };

  return {
    scanForDevices,
    connectToDevice,
    disconnectFromDevice,
    discoveredDevices,
    isScanning,
    connectedDevice
  };
};