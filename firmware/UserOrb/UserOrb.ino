/**
 * User Orb Firmware
 * Role: Dual Mode (Scanner + BLE Server)
 *
 * Scans for Business Orbs and notifies the user's phone
 * when they are near or can claim points.
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

// ============== CONFIGURATION ==============
// IMPORTANT: Each User Orb must have a unique name
// This name must match the storedOrbId in the user's app profile
#define DEVICE_NAME "ORB_001"

// ============== BLE UUIDs ==============
// Business Orb UUID to scan for
#define BUSINESS_SERVICE_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define BUSINESS_CHAR_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// User Orb Service (for phone connection)
#define USER_SERVICE_UUID     "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define USER_NOTIFY_CHAR_UUID "6e400003-b5a3-f393-e0a9-e50e24dcca9e"

// ============== RSSI THRESHOLDS ==============
#define RSSI_NEAR  -80  // Yellow - "You're getting close"
#define RSSI_CLAIM -40  // Green  - "Tap to claim" / Very close

// ============== COOLDOWN ==============
#define CLAIM_COOLDOWN_MS 5000  // 5 seconds between CLAIM notifications
#define NEAR_COOLDOWN_MS  3000  // 3 seconds between NEAR notifications

// ============== LED PINS ==============
// Using RGB LED or separate LEDs
#define LED_RED    25
#define LED_GREEN  26
#define LED_YELLOW 27
// If using built-in LED only:
#define LED_BUILTIN_PIN 2

// ============== GLOBAL STATE ==============
BLEServer* pServer = nullptr;
BLECharacteristic* pNotifyCharacteristic = nullptr;
BLEScan* pBLEScan = nullptr;

bool phoneConnected = false;
bool scanning = false;

// Cooldown tracking per event
struct EventCooldown {
  String eventId;
  unsigned long lastNearNotify;
  unsigned long lastClaimNotify;
};

#define MAX_TRACKED_EVENTS 10
EventCooldown eventCooldowns[MAX_TRACKED_EVENTS];
int trackedEventCount = 0;

// ============== LED CONTROL ==============
void setLedColor(bool red, bool green, bool yellow) {
  digitalWrite(LED_RED, red ? HIGH : LOW);
  digitalWrite(LED_GREEN, green ? HIGH : LOW);
  digitalWrite(LED_YELLOW, yellow ? HIGH : LOW);
}

void setLedOff() {
  setLedColor(false, false, false);
}

void setLedYellow() {
  setLedColor(false, false, true);
}

void setLedGreen() {
  setLedColor(false, true, false);
}

void setLedRed() {
  setLedColor(true, false, false);
}

// ============== COOLDOWN MANAGEMENT ==============
EventCooldown* findOrCreateCooldown(String eventId) {
  // Find existing
  for (int i = 0; i < trackedEventCount; i++) {
    if (eventCooldowns[i].eventId == eventId) {
      return &eventCooldowns[i];
    }
  }

  // Create new if space available
  if (trackedEventCount < MAX_TRACKED_EVENTS) {
    eventCooldowns[trackedEventCount].eventId = eventId;
    eventCooldowns[trackedEventCount].lastNearNotify = 0;
    eventCooldowns[trackedEventCount].lastClaimNotify = 0;
    return &eventCooldowns[trackedEventCount++];
  }

  // Overwrite oldest if full
  eventCooldowns[0].eventId = eventId;
  eventCooldowns[0].lastNearNotify = 0;
  eventCooldowns[0].lastClaimNotify = 0;
  return &eventCooldowns[0];
}

bool canSendNear(EventCooldown* cooldown) {
  return (millis() - cooldown->lastNearNotify) > NEAR_COOLDOWN_MS;
}

bool canSendClaim(EventCooldown* cooldown) {
  return (millis() - cooldown->lastClaimNotify) > CLAIM_COOLDOWN_MS;
}

// ============== PHONE NOTIFICATION ==============
void notifyPhone(String message) {
  if (phoneConnected && pNotifyCharacteristic != nullptr) {
    pNotifyCharacteristic->setValue(message.c_str());
    pNotifyCharacteristic->notify();
    Serial.print("Notified phone: ");
    Serial.println(message);
  }
}

// ============== BLE SERVER CALLBACKS ==============
class PhoneServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    phoneConnected = true;
    setLedRed(); // Red = connected, waiting
    Serial.println("Phone connected!");
  }

  void onDisconnect(BLEServer* pServer) {
    phoneConnected = false;
    setLedOff();
    Serial.println("Phone disconnected");
    // Restart advertising for phone
    pServer->startAdvertising();
  }
};

// ============== BLE SCAN CALLBACKS ==============
class BusinessOrbScanCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) {
    // Check if this device is advertising the Business Orb service
    if (advertisedDevice.haveServiceUUID() &&
        advertisedDevice.isAdvertisingService(BLEUUID(BUSINESS_SERVICE_UUID))) {

      int rssi = advertisedDevice.getRSSI();
      String eventId = "UNKNOWN";

      // Try to read the event ID from the device name or manufacturer data
      if (advertisedDevice.haveName()) {
        // For simplicity, extract event from scan.
        // In production, you'd connect briefly to read the characteristic
        eventId = advertisedDevice.getName().c_str();
      }

      // For this implementation, we'll use a default event ID
      // In production, you'd do a quick connect to read the characteristic
      eventId = "EVENT_123";

      Serial.printf("Found Business Orb! RSSI: %d, Event: %s\n", rssi, eventId.c_str());

      EventCooldown* cooldown = findOrCreateCooldown(eventId);

      if (rssi > RSSI_CLAIM) {
        // Very close - CLAIM range
        if (canSendClaim(cooldown)) {
          setLedGreen();
          notifyPhone("CLAIM:" + eventId);
          cooldown->lastClaimNotify = millis();
          cooldown->lastNearNotify = millis(); // Also reset near cooldown
        }
      } else if (rssi > RSSI_NEAR) {
        // Near range
        if (canSendNear(cooldown)) {
          setLedYellow();
          notifyPhone("NEAR:" + eventId);
          cooldown->lastNearNotify = millis();
        }
      }
    }
  }
};

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  Serial.println("Starting User Orb...");
  Serial.print("Device Name: ");
  Serial.println(DEVICE_NAME);

  // Initialize LEDs
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_BUILTIN_PIN, OUTPUT);
  setLedOff();

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);

  // -------- Setup BLE Server (for phone connection) --------
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new PhoneServerCallbacks());

  // Create service for phone
  BLEService* pService = pServer->createService(USER_SERVICE_UUID);

  // Create notify characteristic
  pNotifyCharacteristic = pService->createCharacteristic(
    USER_NOTIFY_CHAR_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );

  // Add descriptor for notifications
  pNotifyCharacteristic->addDescriptor(new BLE2902());

  // Start service
  pService->start();

  // Start advertising for phone connection
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(USER_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("BLE Server started, waiting for phone...");

  // -------- Setup BLE Scanner (for Business Orbs) --------
  pBLEScan = BLEDevice::getScan();
  pBLEScan->setAdvertisedDeviceCallbacks(new BusinessOrbScanCallbacks());
  pBLEScan->setActiveScan(true);
  pBLEScan->setInterval(100);
  pBLEScan->setWindow(99);

  Serial.println("User Orb ready!");
}

// ============== MAIN LOOP ==============
void loop() {
  // Scan for Business Orbs (non-blocking, short duration)
  // Only scan if phone is connected
  if (phoneConnected) {
    Serial.println("Scanning for Business Orbs...");
    BLEScanResults foundDevices = pBLEScan->start(2, false); // 2 second scan
    pBLEScan->clearResults();
  }

  // Small delay before next scan cycle
  delay(1000);

  // Reset LED if no recent activity
  static unsigned long lastLedReset = 0;
  if (millis() - lastLedReset > 3000) {
    if (phoneConnected) {
      setLedRed(); // Connected but idle
    } else {
      setLedOff();
    }
    lastLedReset = millis();
  }
}
