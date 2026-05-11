/*
 * Простой код для робо руки Arduino Uno
 * Принимает команды через Serial в формате: "A,B,C,D,E\n"
 * где A-E - углы сервоприводов (0-180)
 * 
 * Подключение:
 * Серво 1 (большой палец)    -> Pin 3
 * Серво 2 (указательный)      -> Pin 5  
 * Серво 3 (средний)          -> Pin 6
 * Серво 4 (безымянный)       -> Pin 9
 * Серво 5 (мизинец)          -> Pin 10
 */

#include <Servo.h>

// Создаем объекты для 5 сервоприводов
Servo servos[5];

// Пины подключения сервоприводов (PWM пины на Arduino Uno)
const int pins[5] = {3, 5, 6, 9, 10};

void setup() {
  // Инициализация Serial для приема команд
  Serial.begin(115200);
  
  // Подключаем все сервоприводы и устанавливаем в нейтральное положение
  for (int i = 0; i < 5; i++) {
    servos[i].attach(pins[i]);
    servos[i].write(90); // Нейтральное положение
    delay(100); // Небольшая задержка для плавной инициализации
  }
  
  Serial.println("RoboHand Ready! Send angles as: A,B,C,D,E");
}

void loop() {
  // Проверяем наличие данных в Serial
  if (Serial.available()) {
    // Читаем строку до символа новой строки
    String input = Serial.readStringUntil('\n');
    input.trim(); // Удаляем пробелы и символы перевода строки
    
    // Разбираем строку на углы
    int angles[5];
    int count = 0;
    
    // Разделяем строку по запятым
    int startIndex = 0;
    int endIndex = input.indexOf(',');
    
    while (endIndex != -1 && count < 5) {
      String angleStr = input.substring(startIndex, endIndex);
      angles[count] = constrain(angleStr.toInt(), 0, 180);
      count++;
      
      startIndex = endIndex + 1;
      endIndex = input.indexOf(',', startIndex);
    }
    
    // Получаем последний угол (после последней запятой)
    if (count < 5 && startIndex < input.length()) {
      String angleStr = input.substring(startIndex);
      angles[count] = constrain(angleStr.toInt(), 0, 180);
      count++;
    }
    
    // Если получили все 5 углов, применяем их к сервоприводам
    if (count == 5) {
      for (int i = 0; i < 5; i++) {
        servos[i].write(angles[i]);
      }
      
      // Отправляем подтверждение (опционально)
      Serial.print("OK: ");
      Serial.print(angles[0]);
      for (int i = 1; i < 5; i++) {
        Serial.print(",");
        Serial.print(angles[i]);
      }
      Serial.println();
    } else {
      Serial.println("ERROR: Need 5 angles (A,B,C,D,E)");
    }
  }
}
