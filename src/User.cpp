#include <Arduino.h>
#include <BLEDevice.h>

static BLEUUID serviceUUID("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
static BLEUUID charUUID("beb5483e-36e1-4688-b7f5-ea07361b26a8");

BLEAdvertisedDevice* targetDevice = nullptr;
bool doConnect = false;

// Handle messages sent back from the Company
static void notifyCallback(BLERemoteCharacteristic* pChar, uint8_t* pData, size_t length, bool isNotify) {
    Serial.print("Update from Company: ");
    Serial.write(pData, length);
    Serial.println();
}

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
        if (advertisedDevice.getName() == "COMPANY_DEVICE") {
            if (advertisedDevice.getRSSI() > -70) { // Only connect if signal is decent
                advertisedDevice.getScan()->stop();
                targetDevice = new BLEAdvertisedDevice(advertisedDevice);
                doConnect = true;
            }
        }
    }
};

void setup() {
    Serial.begin(115200);
    Serial.println("User Booting...");
    BLEDevice::init("USER_DEVICE");

    BLEScan* pBLEScan = BLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setInterval(1349);
    pBLEScan->setWindow(449);
    pBLEScan->setActiveScan(true);
    pBLEScan->start(0, false); 
    Serial.println("Scanning...");
}

void loop() {
    if (doConnect && targetDevice != nullptr) {
        BLEClient* pClient = BLEDevice::createClient();
        if (pClient->connect(targetDevice)) {
            Serial.println("Connected!");
            pClient->setMTU(517);

            BLERemoteService* pService = pClient->getService(serviceUUID);
            if (pService != nullptr) {
                BLERemoteCharacteristic* pChar = pService->getCharacteristic(charUUID);
                if (pChar != nullptr) {
                    if (pChar->canNotify()) pChar->registerForNotify(notifyCallback);

                    while (pClient->isConnected()) {
                        int rssi = pClient->getRssi();
                        String rssiVal = String(rssi);
                        pChar->writeValue(rssiVal.c_str(), rssiVal.length());
                        Serial.printf("Sent RSSI: %d\n", rssi);
                        delay(1000);
                    }
                }
            }
        }
        Serial.println("Disconnected. Resuming Scan...");
        delete targetDevice;
        targetDevice = nullptr;
        doConnect = false;
        BLEDevice::getScan()->start(0, false);
    }
}