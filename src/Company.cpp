#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;
// How many points to send during Ultra Proximity
int pointsToGive = -3;
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) { deviceConnected = true; };
    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        BLEDevice::startAdvertising(); // Resume advertising so User can reconnect
        Serial.println("User Disconnected. Advertising...");
    }
};

class MyCharacteristicCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
            int rssi = atoi(value.c_str());
            String response = "";

            // Decision Logic based on RSSI
            if (rssi > -20) {
               response = "DATA_PACKET: ULTRA_CLOSE_PROXIMITY | POINTS:" + String(pointsToGive);
               Serial2.print('O');
            }
            else if (rssi > -60){
                response = "DATA_PACKET: STANDARD_ZONE";
                Serial2.print('G');
            } 
            else {
                response = "DATA_PACKET: WEAK_SIGNAL_IDLE";
                  Serial2.print('O');
            }

            pCharacteristic->setValue(response.c_str());
            pCharacteristic->notify(); // Push the response to the User
            Serial.printf("Received RSSI: %d | Sent: %s\n", rssi, response.c_str());
        }
    }
};

void setup() {
    Serial.begin(115200);
    Serial2.begin(9600, SERIAL_8N1, 16, 17);
    pinMode(27, OUTPUT);
    pinMode(26, OUTPUT);
    BLEDevice::init("COMPANY_DEVICE");
    BLEServer *pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
                        CHARACTERISTIC_UUID,
                        BLECharacteristic::PROPERTY_READ |
                        BLECharacteristic::PROPERTY_WRITE |
                        BLECharacteristic::PROPERTY_NOTIFY
                      );

    // THIS LINE IS CRITICAL FOR NOTIFICATIONS TO WORK
    pCharacteristic->addDescriptor(new BLE2902()); 

    pCharacteristic->setCallbacks(new MyCharacteristicCallbacks());
    pService->start();

    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    BLEDevice::startAdvertising();
    Serial.println("Company Device Live. Waiting for User...");
}

void loop() { delay(2000); }