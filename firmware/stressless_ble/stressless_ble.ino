/*
  StressLess BLE Firmware
  ========================
  Mevcut v8 PPG/BPM motorunun üzerine BLE katmanı eklendi.

  Serial çıktısı (Python pipeline):
    time_ms  ir  ppg  beat  bpm  avg_bpm  finger  ax  ay  az  accmag
    → HİÇ DEĞİŞMEDİ. loggerUart.py / converter.py bozulmaz.

  BLE katmanı:
    Service UUID : 12345678-1234-1234-1234-1234567890ab
    Char UUID    : 12345678-1234-1234-1234-1234567890ef
    Device name  : StressLess
    Her 15 sn'de bir (parmak var + BPM geçerli + min 8 RR intervali):
      {"stress_score":42,"hr":73,"hrv":38,"status":"moderate","source":"heuristic"}

  NOT: BLE skoru kural tabanlı RMSSD heuristiği. Mevcut Logistic Regression +
  baseline-normalized robust9_z pipeline'ıyla aynı değildir; demo amaçlıdır.
*/

// ============================================================
// BLE kütüphaneleri — sadece bu blok yeni
// ============================================================
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ============================================================
// Mevcut kütüphaneler (v8'den değişmedi)
// ============================================================
#include <Wire.h>
#include <math.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ============================================================
// ESP32 I2C pins (değişmedi)
// ============================================================
#define SDA_PIN 10
#define SCL_PIN 11

// ============================================================
// OLED (değişmedi)
// ============================================================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_ADDR 0x3C
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool oledOk = false;
static const int WAVE_Y_TOP = 34;
static const int WAVE_H = 28;
float waveBuffer[SCREEN_WIDTH];
int waveIndex = 0;
unsigned long lastOledUpdateMs = 0;
const unsigned long OLED_UPDATE_MS = 33;

// ============================================================
// MAX30102 (değişmedi)
// ============================================================
MAX30105 particleSensor;
const byte LED_BRIGHTNESS = 0x3F;
const byte SAMPLE_AVERAGE = 4;
const byte LED_MODE = 2;
const int SAMPLE_RATE = 100;
const int PULSE_WIDTH = 411;
const int ADC_RANGE = 4096;
static const long FINGER_ON_THR  = 60000;
static const long FINGER_OFF_THR = 45000;
bool fingerPresent = false;
unsigned long fingerOnTimeMs = 0;
const unsigned long FINGER_SETTLE_MS = 500;

// ============================================================
// BPM motoru (değişmedi)
// ============================================================
const byte RATE_SIZE = 3;
byte rates[RATE_SIZE] = {0};
byte rateSpot = 0;
long lastBeatMs = 0;
float instantBpm = 0.0f;
float displayBpmF = 0.0f;
int beatAvg = 0;
bool bpmValid = false;
bool lastBeatDetected = false;
bool rawBeatEvent = false;
unsigned long beatLatchUntilMs = 0;
unsigned long beatEventCount = 0;
const unsigned long BEAT_LATCH_MS = 180;
const bool PYTHON_STREAM_FORMAT = true;
const bool USE_AUX_BEAT_MARKER = true;
const float AUX_PEAK_THR = 0.45f;
const unsigned long AUX_MIN_INTERVAL_MS = 330;
const unsigned long AUX_MAX_AFTER_RAW_MS = 260;
float auxY2 = 0.0f;
float auxY1 = 0.0f;
float auxY0 = 0.0f;
bool auxHistReady = false;
unsigned long lastAuxBeatMs = 0;
const float BPM_MIN = 35.0f;
const float BPM_MAX = 190.0f;
float lastAcceptedRR = 0.0f;
const float RR_MIN_MS = 315.0f;
const float RR_MAX_MS = 1700.0f;
const float MAX_RR_JUMP_FRAC = 0.55f;

// BPM için küçük buffer (değişmedi — bozulmaz)
const byte RR_BUF_SIZE = 5;
float rrBuf[RR_BUF_SIZE] = {0};
byte rrSpot = 0;
byte rrCount = 0;
const float RR_MEDIAN_REJECT_FRAC = 0.45f;

// ============================================================
// PPG display kalite hesapları (değişmedi)
// ============================================================
float dcEstimate = 0.0f;
float ppgAc = 0.0f;
float ppgDisplay = 0.0f;
float env = 0.0f;
float acMin = 0.0f;
float acMax = 0.0f;
bool acRangeInit = false;
const float DC_TAU_SEC = 2.5f;
const float AC_LP_TAU_SEC = 0.055f;
const float ENV_TAU_SEC = 0.35f;
const float RANGE_TAU_SEC = 1.2f;
float acRange = 0.0f;
float perfusionIndex = 0.0f;
float ppgNorm = 0.0f;
float qualityScore = 0.0f;
unsigned long lastPpgProcessUs = 0;

// ============================================================
// MPU9250 (değişmedi)
// ============================================================
#define MPU9250_ADDR 0x68
#define MPU_PWR_MGMT_1   0x6B
#define MPU_WHO_AM_I     0x75
#define MPU_CONFIG       0x1A
#define MPU_SMPLRT_DIV   0x19
#define MPU_ACCEL_CONFIG 0x1C
#define MPU_ACCEL_XOUT_H 0x3B
static const uint8_t MPU_ACCEL_FS_SEL = 1;
static const float ACCEL_SCALE_LSB_PER_G =
    (MPU_ACCEL_FS_SEL == 0) ? 16384.0f :
    (MPU_ACCEL_FS_SEL == 1) ?  8192.0f :
    (MPU_ACCEL_FS_SEL == 2) ?  4096.0f :
                              2048.0f;
struct ImuSample {
  float ax_g, ay_g, az_g, accMag_g;
  bool ok;
};
const byte ACC_BUF_SIZE = 25;
float accBuf[ACC_BUF_SIZE] = {0};
byte accSpot = 0;
bool accBufFilled = false;
float accMagStd = 0.0f;
bool motionOk = true;
const float ACC_STD_THR = 0.05f;
float latestAx = NAN;
float latestAy = NAN;
float latestAz = NAN;
float latestAccMag = NAN;
unsigned long lastImuUpdateMs = 0;
const unsigned long IMU_UPDATE_MS = 20;

// ============================================================
// Serial debug (değişmedi)
// ============================================================
unsigned long lastSerialMs = 0;
const unsigned long SERIAL_UPDATE_MS = 20;

// ============================================================
// *** YENİ: BLE UUID'leri — HardwareService.ts ile eşleşmeli ***
// ============================================================
#define STRESS_SERVICE_UUID  "12345678-1234-1234-1234-1234567890ab"
#define STRESS_CHAR_UUID     "12345678-1234-1234-1234-1234567890ef"

// *** YENİ: BLE nesneleri ***
BLEServer*         bleServer  = nullptr;
BLECharacteristic* stressChar = nullptr;
bool               bleConnected = false;

// *** YENİ: RMSSD için AYRI büyük RR buffer (mevcut rrBuf[5]'e dokunulmaz) ***
// ~20 atım ≈ 20 sn @ 60 BPM → daha kararlı RMSSD
const byte BLE_RR_SIZE = 20;
float bleRrBuf[BLE_RR_SIZE] = {0};
byte  bleRrSpot  = 0;
byte  bleRrCount = 0;

// *** YENİ: BLE gönderim zamanlaması ***
unsigned long lastBleSendMs    = 0;
const unsigned long BLE_SEND_INTERVAL_MS = 15000;  // 15 sn
const byte          BLE_MIN_RR_COUNT     = 8;       // en az 8 atım intervali

// ============================================================
// *** YENİ: BLE server callback — bağlantı/ayrılma ***
// ============================================================
class StressServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    bleConnected = true;
  }
  void onDisconnect(BLEServer*) override {
    bleConnected = false;
    BLEDevice::startAdvertising();  // tekrar yayın yap
  }
};

// ============================================================
// *** YENİ: BLE başlatma ***
// ============================================================
void initBLE() {
  BLEDevice::init("StressLess");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new StressServerCallbacks());

  BLEService* service = bleServer->createService(STRESS_SERVICE_UUID);
  stressChar = service->createCharacteristic(
    STRESS_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  stressChar->addDescriptor(new BLE2902());
  service->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(STRESS_SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("# BLE hazir: StressLess yayinda");
}

// ============================================================
// *** YENİ: RMSSD hesabı (BLE'ye özel buffer'dan) ***
// Mevcut rrBuf[5] bpm motoru için; bu ayrı ve daha büyük.
// ============================================================
float computeBleRMSSD() {
  if (bleRrCount < 2) return 0.0f;
  byte n = bleRrCount;
  float rr[BLE_RR_SIZE];
  for (byte i = 0; i < n; i++) {
    byte idx = (bleRrSpot + BLE_RR_SIZE - n + i) % BLE_RR_SIZE;
    rr[i] = bleRrBuf[idx];
  }
  float sumSqDiff = 0.0f;
  for (byte i = 1; i < n; i++) {
    float d = rr[i] - rr[i - 1];
    sumSqDiff += d * d;
  }
  return sqrtf(sumSqDiff / (float)(n - 1));
}

// ============================================================
// *** YENİ: BLE JSON gönderimi ***
// Serial çıktısına hiçbir şey eklenmez — tamamen ayrı kanal.
// ============================================================
void maybeSendBLE(unsigned long nowMs) {
  if (!bleConnected)                              return;
  if (!fingerPresent || !bpmValid)                return;
  if (bleRrCount < BLE_MIN_RR_COUNT)              return;
  if (nowMs - lastBleSendMs < BLE_SEND_INTERVAL_MS) return;

  lastBleSendMs = nowMs;

  float rmssd = computeBleRMSSD();

  // Heuristic stres skoru: RMSSD ile ters orantılı
  // 0 ms  → score 100 (yüksek stres)
  // 80 ms → score   0 (rahat)
  float score = 100.0f - (rmssd / 80.0f) * 100.0f;
  if (score < 0.0f)   score = 0.0f;
  if (score > 100.0f) score = 100.0f;

  int scoreInt = (int)(score + 0.5f);
  int hrInt    = (int)(displayBpmF + 0.5f);
  int hrvInt   = (int)(rmssd + 0.5f);

  const char* status;
  if      (score < 35.0f) status = "relaxed";
  else if (score < 65.0f) status = "moderate";
  else                    status = "high";

  // source:"heuristic" → mobil uygulamada ML çıktısıyla karıştırılmasın
  char json[160];
  snprintf(json, sizeof(json),
    "{\"stress_score\":%d,\"hr\":%d,\"hrv\":%d,\"status\":\"%s\",\"source\":\"heuristic\"}",
    scoreInt, hrInt, hrvInt, status);

  stressChar->setValue((uint8_t*)json, strlen(json));
  stressChar->notify();
}

// ============================================================
// I2C helpers (değişmedi)
// ============================================================
bool writeByte(uint8_t devAddr, uint8_t regAddr, uint8_t data) {
  Wire.beginTransmission(devAddr);
  Wire.write(regAddr);
  Wire.write(data);
  return (Wire.endTransmission() == 0);
}
bool readBytes(uint8_t devAddr, uint8_t regAddr, uint8_t count, uint8_t *dest) {
  Wire.beginTransmission(devAddr);
  Wire.write(regAddr);
  if (Wire.endTransmission(false) != 0) return false;
  uint8_t n = Wire.requestFrom((int)devAddr, (int)count);
  if (n != count) return false;
  for (uint8_t i = 0; i < count; i++) dest[i] = Wire.read();
  return true;
}
bool readByte(uint8_t devAddr, uint8_t regAddr, uint8_t &data) {
  return readBytes(devAddr, regAddr, 1, &data);
}

// ============================================================
// MPU9250 (değişmedi)
// ============================================================
bool initMPU9250() {
  uint8_t whoami = 0;
  if (!readByte(MPU9250_ADDR, MPU_WHO_AM_I, whoami)) return false;
  if (!(whoami == 0x71 || whoami == 0x73)) {
    Serial.print("WARNING: Unexpected MPU WHO_AM_I = 0x");
    Serial.println(whoami, HEX);
  }
  if (!writeByte(MPU9250_ADDR, MPU_PWR_MGMT_1, 0x00)) return false;
  delay(100);
  if (!writeByte(MPU9250_ADDR, MPU_PWR_MGMT_1, 0x01)) return false;
  delay(10);
  if (!writeByte(MPU9250_ADDR, MPU_CONFIG, 0x03)) return false;
  if (!writeByte(MPU9250_ADDR, MPU_SMPLRT_DIV, 0x04)) return false;
  uint8_t accelCfg = (MPU_ACCEL_FS_SEL << 3);
  if (!writeByte(MPU9250_ADDR, MPU_ACCEL_CONFIG, accelCfg)) return false;
  return true;
}
ImuSample readMPU9250Accel() {
  ImuSample s = {0, 0, 0, 0, false};
  uint8_t raw[6];
  if (!readBytes(MPU9250_ADDR, MPU_ACCEL_XOUT_H, 6, raw)) return s;
  int16_t axRaw = (int16_t)((raw[0] << 8) | raw[1]);
  int16_t ayRaw = (int16_t)((raw[2] << 8) | raw[3]);
  int16_t azRaw = (int16_t)((raw[4] << 8) | raw[5]);
  s.ax_g = (float)axRaw / ACCEL_SCALE_LSB_PER_G;
  s.ay_g = (float)ayRaw / ACCEL_SCALE_LSB_PER_G;
  s.az_g = (float)azRaw / ACCEL_SCALE_LSB_PER_G;
  s.accMag_g = sqrtf(s.ax_g*s.ax_g + s.ay_g*s.ay_g + s.az_g*s.az_g);
  s.ok = true;
  return s;
}
float computeAccStd(float newAccMag) {
  accBuf[accSpot++] = newAccMag;
  if (accSpot >= ACC_BUF_SIZE) { accSpot = 0; accBufFilled = true; }
  byte n = accBufFilled ? ACC_BUF_SIZE : accSpot;
  if (n < 5) return 0.0f;
  float mean = 0.0f;
  for (byte i = 0; i < n; i++) mean += accBuf[i];
  mean /= n;
  float var = 0.0f;
  for (byte i = 0; i < n; i++) { float d = accBuf[i]-mean; var += d*d; }
  var /= (n - 1);
  return sqrtf(var);
}
void updateMotion(unsigned long nowMs) {
  if (nowMs - lastImuUpdateMs < IMU_UPDATE_MS) return;
  lastImuUpdateMs = nowMs;
  ImuSample imu = readMPU9250Accel();
  if (imu.ok) {
    latestAx = imu.ax_g; latestAy = imu.ay_g;
    latestAz = imu.az_g; latestAccMag = imu.accMag_g;
    accMagStd = computeAccStd(imu.accMag_g);
    motionOk = accMagStd <= ACC_STD_THR;
  } else {
    latestAx = NAN; latestAy = NAN; latestAz = NAN; latestAccMag = NAN;
    motionOk = true; accMagStd = 0.0f;
  }
}

// ============================================================
// Reset helpers (değişmedi + BLE buffer reset eklendi)
// ============================================================
void resetWaveBuffer() {
  for (int i = 0; i < SCREEN_WIDTH; i++) waveBuffer[i] = 0.0f;
  waveIndex = 0;
}
void resetBpmState() {
  for (byte i = 0; i < RATE_SIZE; i++) rates[i] = 0;
  rateSpot = 0; lastBeatMs = 0; instantBpm = 0.0f;
  displayBpmF = 0.0f; beatAvg = 0; bpmValid = false;
  lastAcceptedRR = 0.0f; lastBeatDetected = false;
  rawBeatEvent = false; beatLatchUntilMs = 0; beatEventCount = 0;
  for (byte i = 0; i < RR_BUF_SIZE; i++) rrBuf[i] = 0.0f;
  rrSpot = 0; rrCount = 0;
  auxY2 = 0.0f; auxY1 = 0.0f; auxY0 = 0.0f;
  auxHistReady = false; lastAuxBeatMs = 0;
  // *** YENİ: parmak kalktığında BLE RR buffer'ı da sıfırla ***
  for (byte i = 0; i < BLE_RR_SIZE; i++) bleRrBuf[i] = 0.0f;
  bleRrSpot = 0; bleRrCount = 0;
  lastBleSendMs = 0;
}
void resetPpgCalc() {
  dcEstimate = 0.0f; ppgAc = 0.0f; ppgDisplay = 0.0f;
  env = 0.0f; acMin = 0.0f; acMax = 0.0f; acRangeInit = false;
  acRange = 0.0f; perfusionIndex = 0.0f; ppgNorm = 0.0f;
  qualityScore = 0.0f; lastPpgProcessUs = 0;
  resetWaveBuffer();
}

// ============================================================
// Finger detection (değişmedi)
// ============================================================
void updateFingerState(long irValue, unsigned long nowMs) {
  if (!fingerPresent) {
    if (irValue >= FINGER_ON_THR) {
      fingerPresent = true; fingerOnTimeMs = nowMs;
      resetBpmState(); resetPpgCalc();
    }
  } else {
    if (irValue <= FINGER_OFF_THR) {
      fingerPresent = false; fingerOnTimeMs = 0;
      resetBpmState(); resetPpgCalc();
    }
  }
}

// ============================================================
// PPG quality / display calculation (değişmedi)
// ============================================================
float alphaFromTau(float dtSec, float tauSec) {
  if (tauSec <= 0.0f) return 0.0f;
  return expf(-dtSec / tauSec);
}
void updatePpgCalculations(long irValue) {
  unsigned long nowUs = micros();
  float dtSec = 1.0f / 100.0f;
  if (lastPpgProcessUs != 0) {
    unsigned long dtUs = nowUs - lastPpgProcessUs;
    if (dtUs > 500 && dtUs < 200000) dtSec = (float)dtUs / 1000000.0f;
  }
  lastPpgProcessUs = nowUs;
  float x = (float)irValue;
  if (dcEstimate == 0.0f) dcEstimate = x;
  float alphaDc = alphaFromTau(dtSec, DC_TAU_SEC);
  dcEstimate = alphaDc * dcEstimate + (1.0f - alphaDc) * x;
  float acRaw = x - dcEstimate;
  float alphaLp = alphaFromTau(dtSec, AC_LP_TAU_SEC);
  ppgAc = alphaLp * ppgAc + (1.0f - alphaLp) * acRaw;
  float alphaEnv = alphaFromTau(dtSec, ENV_TAU_SEC);
  env = alphaEnv * env + (1.0f - alphaEnv) * fabsf(ppgAc);
  if (!acRangeInit) {
    acMin = ppgAc; acMax = ppgAc; acRangeInit = true;
  } else {
    float alphaRange = alphaFromTau(dtSec, RANGE_TAU_SEC);
    acMin = alphaRange * acMin + (1.0f - alphaRange) * ppgAc;
    acMax = alphaRange * acMax + (1.0f - alphaRange) * ppgAc;
    if (ppgAc < acMin) acMin = ppgAc;
    if (ppgAc > acMax) acMax = ppgAc;
  }
  acRange = fabsf(acMax - acMin);
  perfusionIndex = (dcEstimate > 1.0f) ? (acRange / dcEstimate) : 0.0f;
  float normDen = env;
  if (normDen < 4.0f) normDen = 4.0f;
  ppgNorm = ppgAc / normDen;
  if (ppgNorm > 2.5f) ppgNorm = 2.5f;
  if (ppgNorm < -2.5f) ppgNorm = -2.5f;
  ppgDisplay = -ppgNorm;
  float qIr = (irValue >= FINGER_ON_THR) ? 35.0f : 0.0f;
  float qPi = perfusionIndex * 25000.0f; if (qPi > 35.0f) qPi = 35.0f;
  float qAc = acRange / 2.0f; if (qAc > 20.0f) qAc = 20.0f;
  float qMotion = motionOk ? 10.0f : 0.0f;
  qualityScore = qIr + qPi + qAc + qMotion;
  if (qualityScore > 100.0f) qualityScore = 100.0f;
}

// ============================================================
// BPM — heartRate.h referans (değişmedi)
// ============================================================
float medianOfArray(float *arr, byte n) {
  if (n == 0) return 0.0f;
  float tmp[RR_BUF_SIZE];
  for (byte i = 0; i < n; i++) tmp[i] = arr[i];
  for (byte i = 0; i < n; i++)
    for (byte j = i+1; j < n; j++)
      if (tmp[j] < tmp[i]) { float t=tmp[i]; tmp[i]=tmp[j]; tmp[j]=t; }
  if (n & 1) return tmp[n/2];
  return 0.5f * (tmp[(n/2)-1] + tmp[n/2]);
}
float currentMedianRR() { return medianOfArray(rrBuf, rrCount); }
void pushRR(float rrMs) {
  rrBuf[rrSpot++] = rrMs;
  if (rrSpot >= RR_BUF_SIZE) rrSpot = 0;
  if (rrCount < RR_BUF_SIZE) rrCount++;
}
bool rrAccepted(float rrMs) {
  if (rrMs < RR_MIN_MS || rrMs > RR_MAX_MS) return false;
  if (lastAcceptedRR > 0.0f) {
    float jumpFrac = fabsf(rrMs - lastAcceptedRR) / lastAcceptedRR;
    if (bpmValid && jumpFrac > MAX_RR_JUMP_FRAC) return false;
  }
  if (rrCount >= 3) {
    float medRR = currentMedianRR();
    if (medRR > 0.0f && fabsf(rrMs-medRR)/medRR > RR_MEDIAN_REJECT_FRAC) return false;
  }
  return true;
}
void pushBpmFromRR(float rrMs) {
  float rawBpm = 60000.0f / rrMs;
  if (rawBpm < BPM_MIN || rawBpm > BPM_MAX) return;
  instantBpm = rawBpm;
  pushRR(rrMs);

  // *** YENİ: aynı kabul edilen RR'ı BLE buffer'ına da ekle ***
  bleRrBuf[bleRrSpot++] = rrMs;
  if (bleRrSpot >= BLE_RR_SIZE) bleRrSpot = 0;
  if (bleRrCount < BLE_RR_SIZE) bleRrCount++;

  rates[rateSpot++] = (byte)(rawBpm + 0.5f);
  rateSpot %= RATE_SIZE;
  int sum = 0; byte count = 0;
  for (byte i = 0; i < RATE_SIZE; i++) if (rates[i] > 0) { sum += rates[i]; count++; }
  if (count > 0) beatAvg = sum / count;
  if (!bpmValid || displayBpmF <= 0.0f) {
    displayBpmF = rawBpm; bpmValid = true;
  } else {
    float diff = fabsf(rawBpm - displayBpmF);
    float a = 0.45f;
    if (diff > 18.0f) a = (motionOk && rrCount >= 2) ? 0.35f : 0.18f;
    if (!motionOk) a *= 0.35f;
    displayBpmF = (1.0f - a) * displayBpmF + a * rawBpm;
  }
}
bool updateHeartRateReference(long irValue, unsigned long nowMs) {
  rawBeatEvent = false;
  if (fingerPresent && checkForBeat(irValue)) {
    rawBeatEvent = true; beatEventCount++;
    beatLatchUntilMs = nowMs + BEAT_LATCH_MS;
    long delta = nowMs - lastBeatMs;
    lastBeatMs = nowMs;
    if (delta > 0 && rrAccepted((float)delta)) {
      lastAcceptedRR = (float)delta;
      pushBpmFromRR((float)delta);
    }
  }
  lastBeatDetected = fingerPresent && (nowMs < beatLatchUntilMs);
  return rawBeatEvent;
}

// ============================================================
// Auxiliary beat marker (değişmedi)
// ============================================================
bool updateAuxBeatMarker(unsigned long nowMs) {
  if (!USE_AUX_BEAT_MARKER || !fingerPresent) return false;
  auxY2 = auxY1; auxY1 = auxY0; auxY0 = ppgDisplay;
  if (!auxHistReady) {
    if (auxY2!=0.0f||auxY1!=0.0f||auxY0!=0.0f) auxHistReady = true;
    return false;
  }
  bool localPeak = (auxY1 > auxY2) && (auxY1 >= auxY0);
  bool amplitudeOk = auxY1 > AUX_PEAK_THR;
  unsigned long lastAnyBeatMs = lastBeatMs;
  if (lastAuxBeatMs > lastAnyBeatMs) lastAnyBeatMs = lastAuxBeatMs;
  bool intervalOk = (lastAnyBeatMs==0)||((nowMs-lastAnyBeatMs)>=AUX_MIN_INTERVAL_MS);
  bool notImmediatelyAfterRaw = (lastBeatMs==0)||((nowMs-lastBeatMs)>=AUX_MAX_AFTER_RAW_MS);
  bool qualityOk = qualityScore >= 35.0f;
  bool auxBeat = localPeak && amplitudeOk && intervalOk &&
                 notImmediatelyAfterRaw && motionOk && qualityOk;
  if (auxBeat) {
    lastAuxBeatMs = nowMs;
    beatLatchUntilMs = nowMs + BEAT_LATCH_MS;
    lastBeatDetected = true;
  }
  return auxBeat;
}

// ============================================================
// OLED (değişmedi)
// ============================================================
void initOLED() {
  oledOk = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  if (!oledOk) { Serial.println("WARNING: OLED not found."); return; }
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("StressLess BLE");
  display.println("Hazirlanıyor...");
  display.display();
  delay(800);
  resetWaveBuffer();
}
void pushWaveSample(float v) {
  waveBuffer[waveIndex++] = v;
  if (waveIndex >= SCREEN_WIDTH) waveIndex = 0;
}
void updateOLED(unsigned long nowMs) {
  if (!oledOk) return;
  if (nowMs - lastOledUpdateMs < OLED_UPDATE_MS) return;
  lastOledUpdateMs = nowMs;
  float v = fingerPresent ? ppgDisplay : 0.0f;
  pushWaveSample(v);
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("BPM:");
  if (fingerPresent && bpmValid) display.print((int)(displayBpmF+0.5f));
  else display.print("--");
  display.setCursor(74, 0);
  display.print("PI:");
  display.print(perfusionIndex*100.0f, 3);
  display.print("%");
  display.setCursor(0, 10);
  display.print("Finger:");
  display.print(fingerPresent ? "OK" : "NO");
  display.setCursor(0, 20);
  display.print("BLE:");
  // *** YENİ: OLED'de BLE bağlantı durumu ***
  display.print(bleConnected ? "BAGLI" : "Bekliyor");
  const int heartX=112, heartY=22, r=3;
  if (lastBeatDetected) {
    display.drawCircle(heartX-4,heartY-5,r,SSD1306_WHITE);
    display.drawCircle(heartX+4,heartY-5,r,SSD1306_WHITE);
    display.drawLine(heartX-7,heartY-2,heartX,heartY+6,SSD1306_WHITE);
    display.drawLine(heartX+7,heartY-2,heartX,heartY+6,SSD1306_WHITE);
  } else {
    display.fillCircle(heartX-4,heartY-5,r,SSD1306_WHITE);
    display.fillCircle(heartX+4,heartY-5,r,SSD1306_WHITE);
    display.fillTriangle(heartX-8,heartY-3,heartX+8,heartY-3,heartX,heartY+7,SSD1306_WHITE);
  }
  display.drawLine(0,32,SCREEN_WIDTH-1,32,SSD1306_WHITE);
  int prevX=0, prevY=WAVE_Y_TOP+WAVE_H/2;
  for (int x=0;x<SCREEN_WIDTH;x++) {
    int idx=(waveIndex+x)%SCREEN_WIDTH;
    float s=waveBuffer[idx];
    if (s>2.5f) s=2.5f; if (s<-2.5f) s=-2.5f;
    float n01=(s+2.5f)/5.0f;
    int y=WAVE_Y_TOP+WAVE_H-1-(int)(n01*(WAVE_H-1));
    if (y<WAVE_Y_TOP) y=WAVE_Y_TOP;
    if (y>WAVE_Y_TOP+WAVE_H-1) y=WAVE_Y_TOP+WAVE_H-1;
    if (x>0) display.drawLine(prevX,prevY,x,y,SSD1306_WHITE);
    prevX=x; prevY=y;
  }
  display.display();
}

// ============================================================
// Serial debug — HİÇ DEĞİŞMEDİ
// Python pipeline (loggerUart.py, converter.py) bozulmaz.
// ============================================================
void printSerial(unsigned long nowMs, long irValue, bool rawBeat, bool auxBeat) {
  if (nowMs - lastSerialMs < SERIAL_UPDATE_MS) return;
  lastSerialMs = nowMs;
  int beatForStream = lastBeatDetected ? 1 : 0;
  int fingerForStream = fingerPresent ? 1 : 0;
  if (PYTHON_STREAM_FORMAT) {
    static bool headerPrinted = false;
    if (!headerPrinted) {
      Serial.println("time_ms\tir\tppg\tbeat\tbpm\tavg_bpm\tfinger\tax\tay\taz\taccmag");
      headerPrinted = true;
    }
    Serial.print(nowMs);          Serial.print('\t');
    Serial.print(irValue);        Serial.print('\t');
    Serial.print(ppgDisplay, 4);  Serial.print('\t');
    Serial.print(beatForStream);  Serial.print('\t');
    Serial.print(bpmValid ? displayBpmF : 0.0f, 1); Serial.print('\t');
    Serial.print(bpmValid ? beatAvg : 0);            Serial.print('\t');
    Serial.print(fingerForStream);                   Serial.print('\t');
    if (isnan(latestAx)) Serial.print("nan"); else Serial.print(latestAx, 4); Serial.print('\t');
    if (isnan(latestAy)) Serial.print("nan"); else Serial.print(latestAy, 4); Serial.print('\t');
    if (isnan(latestAz)) Serial.print("nan"); else Serial.print(latestAz, 4); Serial.print('\t');
    if (isnan(latestAccMag)) Serial.println("nan"); else Serial.println(latestAccMag, 4);
    return;
  }
  // Arduino Serial Plotter debug (değişmedi)
  Serial.print("IR:"); Serial.print(irValue); Serial.print('\t');
  Serial.print("PPG_DISP:"); Serial.print(ppgDisplay, 3); Serial.print('\t');
  Serial.print("BEAT_MARK:"); Serial.print(lastBeatDetected ? 2.2f : 0.0f, 1); Serial.print('\t');
  Serial.print("BEAT_RAW:"); Serial.print(rawBeat ? 2.5f : 0.0f, 1); Serial.print('\t');
  Serial.print("BEAT_AUX:"); Serial.print(auxBeat ? 2.0f : 0.0f, 1); Serial.print('\t');
  Serial.print("DISP_BPM:"); Serial.print(bpmValid ? displayBpmF : 0.0f, 1); Serial.print('\t');
  Serial.print("AVG_BPM:"); Serial.print(beatAvg); Serial.print('\t');
  Serial.print("FINGER:"); Serial.print(fingerPresent ? 1 : 0); Serial.print('\t');
  Serial.print("MOTION_OK:"); Serial.print(motionOk ? 1 : 0); Serial.print('\t');
  Serial.print("Q:"); Serial.print(qualityScore, 1); Serial.print('\t');
  Serial.print("AC_RANGE:"); Serial.print(acRange, 1); Serial.print('\t');
  Serial.print("PI_X10000:"); Serial.print(perfusionIndex*10000.0f, 2); Serial.print('\t');
  Serial.print("ACC_STD:"); Serial.println(accMagStd, 4);
}

// ============================================================
// Setup
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(700);
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  initOLED();
  initBLE();  // *** YENİ: BLE başlat ***
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("ERROR: MAX30102/MAX30105 not found.");
    while (1) delay(100);
  }
  particleSensor.setup(LED_BRIGHTNESS, SAMPLE_AVERAGE, LED_MODE, SAMPLE_RATE, PULSE_WIDTH, ADC_RANGE);
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeIR(LED_BRIGHTNESS);
  if (!initMPU9250()) {
    Serial.println("WARNING: MPU9250 init failed. Continuing.");
  }
  resetBpmState();
  resetPpgCalc();
}

// ============================================================
// Loop
// ============================================================
void loop() {
  unsigned long nowMs = millis();
  long irValue = particleSensor.getIR();
  updateFingerState(irValue, nowMs);
  updateMotion(nowMs);
  if (fingerPresent) {
    updatePpgCalculations(irValue);
  } else {
    lastBeatDetected = false;
    rawBeatEvent = false;
    beatLatchUntilMs = 0;
  }
  bool beat = false;
  if (fingerPresent && (nowMs - fingerOnTimeMs >= FINGER_SETTLE_MS)) {
    beat = updateHeartRateReference(irValue, nowMs);
  } else {
    if (fingerPresent) {
      rawBeatEvent = false;
      if (checkForBeat(irValue)) {
        rawBeatEvent = true; beatEventCount++;
        beatLatchUntilMs = nowMs + BEAT_LATCH_MS;
      }
      lastBeatDetected = fingerPresent && (nowMs < beatLatchUntilMs);
    }
  }
  bool auxBeat = false;
  if (fingerPresent && (nowMs - fingerOnTimeMs >= FINGER_SETTLE_MS)) {
    auxBeat = updateAuxBeatMarker(nowMs);
  }
  lastBeatDetected = fingerPresent && (nowMs < beatLatchUntilMs);
  updateOLED(nowMs);
  printSerial(nowMs, irValue, beat, auxBeat);  // Serial değişmedi
  maybeSendBLE(nowMs);  // *** YENİ: BLE ayrı kanal ***
}
