#include "HX711.h"
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>

// Pins
#define DOUT  3
#define CLK   2
#define BUZZER_PIN 8
#define BT_RX 10
#define BT_TX 11

// Objects
HX711 scale;
LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial bluetooth(BT_RX, BT_TX);

// Updated Factor to fix the +35-40g offset
float calibration_factor = -99.1; 

#define LOW_OXYGEN_THRESHOLD 10.0  
#define RESET_MARGIN 20.0          
bool wasAboveThreshold = true;

void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);
  lcd.init();
  lcd.backlight();
  
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, HIGH); 

  scale.begin(DOUT, CLK);
  
  lcd.setCursor(0,0);
  lcd.print("DO NOT TOUCH");
  lcd.setCursor(0,1);
  lcd.print("TARING SCALE...");
  
  delay(5000); // 5s to ensure no vibrations
  
  scale.set_scale(calibration_factor);
  scale.tare(); 

  lcd.clear();
  lcd.print("SYSTEM READY");
  delay(1000);
}

void loop() {
  if (!scale.is_ready()) return;

  float weight = scale.get_units(30); 
  if (weight < 0) weight = 0; 

  // LCD Update
  lcd.setCursor(0,0);
  lcd.print("Weight:         "); 
  lcd.setCursor(8,0);
  lcd.print(weight, 1);
  lcd.print(" g");

  // Alert Logic
  if (weight < LOW_OXYGEN_THRESHOLD && wasAboveThreshold) {
    bluetooth.println("ALERT: OXYGEN LOW!");
    digitalWrite(BUZZER_PIN, LOW);   
    wasAboveThreshold = false;
    lcd.setCursor(0,1);
    lcd.print("!!! LOW OXY !!! ");
  }

  // Reset Logic
  if (weight >= LOW_OXYGEN_THRESHOLD + RESET_MARGIN) {
    if (!wasAboveThreshold) {
      digitalWrite(BUZZER_PIN, HIGH); 
      wasAboveThreshold = true;
      lcd.setCursor(0,1);
      lcd.print("                ");
    }
  }

  delay(200);
}
