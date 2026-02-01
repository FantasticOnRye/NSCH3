const int redPin = 9;
const int greenPin = 10;
const int bluePin = 11;

char currentMode = 'W'; 
unsigned long lastUpdate = 0;
int brightness = 0;
int fadeDirection = 1;

// "speed" is the delay in ms between each brightness step. 
// Smaller = Faster pulse. Larger = Slower pulse.
int pulseSpeed = 20; 

void setup() {
  Serial.begin(115200);
  Serial1.begin(9600); 
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  // Check Serial1 for mode or speed changes
  if (Serial1.available() > 0) {
    if (isDigit(Serial1.peek())) {
      // If the incoming data is a number, update the pulse speed
      pulseSpeed = Serial1.parseInt();
    } else {
      // If it's a character, update the color mode
      char incomingByte = Serial1.read();
      if (incomingByte == 'O' || incomingByte == 'G' || 
          incomingByte == 'R' || incomingByte == 'W') {
        currentMode = incomingByte;
      }
    }
  }

  // Define color targets (Based on Common Anode: 0 is full, 255 is off)
  int rT, gT, bT;

  switch (currentMode) {
    case 'O': // Orange
      rT = 0; gT = 150; bT = 255; 
      break;
    case 'G': // Green
      rT = 255; gT = 0; bT = 255; 
      break;
    case 'R': // Red
      rT = 0; gT = 255; bT = 255; 
      break;
    case 'W': // White
    default:
      rT = 0; gT = 0; bT = 0; 
      break;
  }

  // Non-blocking pulse logic
  if (millis() - lastUpdate >= pulseSpeed) {
    lastUpdate = millis();
    brightness += fadeDirection;
    
    if (brightness >= 255 || brightness <= 0) {
      fadeDirection *= -1;
    }

    // Standard GRB mapping using analogWrite
    analogWrite(redPin,   map(brightness, 0, 255, 255, rT));
    analogWrite(greenPin, map(brightness, 0, 255, 255, gT));
    analogWrite(bluePin,  map(brightness, 0, 255, 255, bT));
  }
}