#include <ESP8266WiFi.h>
#include <PubSubClient.h>

#define SENSOR_PIN A0
#define RELAY_PIN  D7   // Active-LOW relay

// -------- Calibration --------
const int DRY_VALUE = 600;
const int WET_VALUE = 300;

// -------- Auto thresholds --------
const int MOISTURE_ON  = 30;   // Pump ON when crossing below
const int MOISTURE_OFF = 70;   // Pump OFF when crossing above

// -------- WiFi --------
const char* ssid = "Swayam";
const char* password = "swym2459";

// -------- MQTT --------
const char* mqtt_server = "c946cbf4bb284a01a41608824a6630cb.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char* mqtt_user = "Swayam";
const char* mqtt_pass = "Swym(232459)";

WiFiClientSecure espClient;
PubSubClient client(espClient);

bool pumpOn = false;
bool autoMode = false;
int lastMoisture = -1;   // 🔑 KEY FIX

// -------- Relay control (ACTIVE-LOW) --------
void setPump(bool on) {
  pumpOn = on;
  digitalWrite(RELAY_PIN, on ? LOW : HIGH);
  client.publish("plant/pump/status", pumpOn ? "ON" : "OFF");
}

// -------- MQTT callback --------
void callback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];

  String t = String(topic);

  if (t == "plant/auto") {
    autoMode = (msg == "ON");
    client.publish("plant/auto/status", autoMode ? "ON" : "OFF");
    // ❌ DO NOT TOUCH PUMP HERE
  }

  if (t == "plant/pump" && !autoMode) {
    if (msg == "ON")  setPump(true);
    if (msg == "OFF") setPump(false);
  }
}

// -------- MQTT reconnect --------
void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP8266_Plant", mqtt_user, mqtt_pass)) {
      client.subscribe("plant/auto");
      client.subscribe("plant/pump");

      client.publish("plant/auto/status", autoMode ? "ON" : "OFF");
      client.publish("plant/pump/status", pumpOn ? "ON" : "OFF");
    } else {
      delay(5000);
    }
  }
}

// -------- Setup --------
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH); // OFF by default (active-low)

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);

  espClient.setInsecure();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

// -------- Loop --------
void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  static unsigned long lastRead = 0;
  if (millis() - lastRead > 2000) {
    lastRead = millis();

    int raw = analogRead(SENSOR_PIN);
    int moisture = map(raw, DRY_VALUE, WET_VALUE, 0, 100);
    moisture = constrain(moisture, 0, 100);

    char buf[8];
    snprintf(buf, sizeof(buf), "%d", moisture);
    client.publish("plant/moisture", buf);

    // -------- EDGE-BASED AUTO MODE --------
    if (autoMode && lastMoisture != -1) {

      // Crossing BELOW dry threshold → turn ON
      if (lastMoisture > MOISTURE_ON && moisture <= MOISTURE_ON && !pumpOn) {
        setPump(true);
      }

      // Crossing ABOVE wet threshold → turn OFF
      if (lastMoisture < MOISTURE_OFF && moisture >= MOISTURE_OFF && pumpOn) {
        setPump(false);
      }
    }

    lastMoisture = moisture;  // 🔑 update history
  }
}
