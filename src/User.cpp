#include <Arduino.h>
#include <BLEDevice.h>

static BLEUUID serviceUUID("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
static BLEUUID charUUID("beb5483e-36e1-4688-b7f5-ea07361b26a8");
int userPoints = 0;       // The total points stored on the device
bool pointAwarded = false; // Prevents spamming points while standing still
BLEAdvertisedDevice* targetDevice = nullptr;
bool doConnect = false;

// Device tracking (Up to 10)
String foundAddresses[10];
int deviceCount = 0;
bool firstmessage=true;
// Notification callback: The "Gatekeeper"
static void notifyCallback(BLERemoteCharacteristic* pChar, uint8_t* pData, size_t length, bool isNotify) {
    String message = "";
    for (size_t i = 0; i < length; i++) message += (char)pData[i];

    if ((message.indexOf("ULTRA_CLOSE_PROXIMITY") != -1) || firstmessage == true) {
        digitalWrite(26, HIGH);
        Serial.println(">>> [AUTHORIZED MESSAGE]: " + message);
        
        // --- NEW POINT LOGIC ---
        // Look for the "POINTS:" marker in the message
    int pointIndex = message.indexOf("POINTS:");
    
    if (pointIndex != -1 && !pointAwarded) {
        // Extract the number string after "POINTS:"
        String pointVal = message.substring(pointIndex + 7); 
        
        // .toInt() automatically handles "-" for negative numbers
        int receivedPoints = pointVal.toInt(); 
        
        userPoints += receivedPoints;
        if (userPoints < 0) userPoints = 0;
        pointAwarded = true; 

        Serial.print(">>> POINT ADJUSTMENT: ");
        Serial.print(receivedPoints);
        Serial.print(" | NEW TOTAL: ");
        Serial.println(userPoints);
    }
        
        firstmessage = false;
    }
digitalWrite(26, LOW);
}

class MyAdvertisedDeviceCallbacks: public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) {
        if (advertisedDevice.getName() == "COMPANY_DEVICE") {
            if (advertisedDevice.getRSSI() > -70) {
                // Tracking the last 10 devices seen
                String addr = advertisedDevice.getAddress().toString().c_str();
                foundAddresses[deviceCount % 10] = addr; 
                deviceCount++;

                advertisedDevice.getScan()->stop();
                targetDevice = new BLEAdvertisedDevice(advertisedDevice);
                firstmessage=true;
                doConnect = true;
            }
        }
    }
};

void setup() {
    Serial.begin(115200);
    BLEDevice::init("USER_DEVICE");
    pinMode(27, OUTPUT);
    pinMode(26, OUTPUT);
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
            Serial.println("Connected. Reporting RSSI...");
            pClient->setMTU(517);
            digitalWrite(27, HIGH);
            BLERemoteService* pService = pClient->getService(serviceUUID);

            if (pService != nullptr) {
                BLERemoteCharacteristic* pChar = pService->getCharacteristic(charUUID);
                if (pChar != nullptr) {
                    delay(500); // Wait for handshake

                    // Force the descriptor discovery to clear the error
                    pChar->getDescriptor(BLEUUID((uint16_t)0x2902)); 

                    if (pChar->canNotify()) {
                        pChar->registerForNotify(notifyCallback);
                        Serial.println(">>> Subscribed successfully.");
                    }

                    while (pClient->isConnected()) {
                        int rssi = pClient->getRssi();
                        
                        // Only write if the characteristic allows it
                        if (pChar->canWrite()) {
                            String rssiVal = String(rssi);
                            pChar->writeValue(rssiVal.c_str(), rssiVal.length());
                            //Serial.printf("Sent RSSI: %d\n", rssi); // Confirming send
                        } else {
                            Serial.println("Error: Cannot write to characteristic.");
                        }
                        
                        delay(1000); 
                    }
                }
            }
        }
        
        // Cleanup if connection drops
        delete targetDevice;
        digitalWrite(27, LOW);
        targetDevice = nullptr;
        // Put this at the very bottom of the loop() block
        pointAwarded = false; 
        doConnect = false;
        BLEDevice::getScan()->start(0, false);
        doConnect = false;
        BLEDevice::getScan()->start(0, false);
    }
}