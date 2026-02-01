/**
 * Business Orb Firmware
 * Role: BLE Server (Advertiser)
 *
 * Continuously advertises a Service UUID with event data.
 * Place this at a business location to create a "check-in" zone.
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Configuration - Change these for each Business Orb
#define DEVICE_NAME "BIZ_ORB_001"
#define EVENT_ID "EVENT_123"

// BLE UUIDs
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// LED Pin (built-in on most ESP32 boards)
#define LED_PIN 2

BLEServer* pServer = nullptr;
BLECharacteristic* pCharacteristic = nullptr;
bool deviceConnected = false;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("Device connected");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("Device disconnected");
    // Restart advertising
    pServer->startAdvertising();
  }
};

void setup() {
  Serial.begin(115200);
  Serial.println("Starting Business Orb...");

  // Initialize LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // LED on = Orb active

  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);

  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  // Create BLE Service
  BLEService* pService = pServer->createService(SERVICE_UUID);

  // Create BLE Characteristic with READ property
  pCharacteristic = pService->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ
  );

  // Set the event ID as the characteristic value
  pCharacteristic->setValue(EVENT_ID);

  // Start the service
  pService->start();

  // Configure advertising
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);  // For iPhone compatibility
  pAdvertising->setMinPreferred(0x12);

  // Start advertising
  BLEDevice::startAdvertising();

  Serial.println("Business Orb active!");
  Serial.print("Device Name: ");
  Serial.println(DEVICE_NAME);
  Serial.print("Event ID: ");
  Serial.println(EVENT_ID);
}

void loop() {
  // Blink LED to show orb is active
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > 2000) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    lastBlink = millis();
  }

  delay(100);
}
