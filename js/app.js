// === Глобальные переменные ===
let hands, camera;
let port = null;
let writer = null;
let isTransmitting = false;
let isCameraActive = false;
let targetHand = 'Left';
let detectedHand = 'None';
let currentAngles = [90, 90, 90, 90, 90];
let smoothedAngles = [90, 90, 90, 90, 90];
let previousAngles = [90, 90, 90, 90, 90];
const smoothingFactor = 0.15; // Уменьшено для более плавного движения (было 0.3)
const minAngleChange = 3; // Минимальное изменение угла для отправки (фильтр шума)

// FPS счетчик
let fps = 0;
let frameCount = 0;
let lastTime = performance.now();
let fpsUpdateInterval = 500; // Обновляем FPS каждые 500ms

const videoElement = document.getElementById('videoElement');
const canvasElement = document.getElementById('canvasElement');
const canvasCtx = canvasElement.getContext('2d');

// === Система логирования ===
function log(message, type = 'info') {
    const logWindow = document.getElementById('logWindow');
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span>${message}`;
    
    logWindow.appendChild(entry);
    logWindow.scrollTop = logWindow.scrollHeight;
    
    // Ограничиваем количество логов (последние 100)
    while (logWindow.children.length > 100) {
        logWindow.removeChild(logWindow.firstChild);
    }
}

function clearLogs() {
    document.getElementById('logWindow').innerHTML = '';
    log('Логи очищены', 'info');
}

// === Константы для рисования ===
const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17]
];

// === Функции рисования ===
function drawConnectors(ctx, landmarks, connections, style) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    
    for (let connection of connections) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];
        ctx.beginPath();
        ctx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
        ctx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
        ctx.stroke();
    }
}

function drawLandmarks(ctx, landmarks, style) {
    ctx.fillStyle = style.color;
    
    for (let landmark of landmarks) {
        const x = landmark.x * canvasElement.width;
        const y = landmark.y * canvasElement.height;
        ctx.beginPath();
        ctx.arc(x, y, style.radius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// === Инициализация MediaPipe ===
function initMediaPipe() {
    hands = new Hands({
        locateFile: (file) => {
            // Возвращаем локальный путь
            return `models/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,  // Поддержка двух рук
        modelComplexity: 0, // Переключаем на Lite (было 1/Full)
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);
}

// === Обработка результатов MediaPipe ===
function onResults(results) {
    // Подсчет FPS (более точный метод)
    frameCount++;
    const now = performance.now();
    const elapsed = now - lastTime;
    
    if (elapsed >= fpsUpdateInterval) {
        fps = Math.round((frameCount * 1000) / elapsed);
        frameCount = 0;
        lastTime = now;
        document.getElementById('fpsCounter').textContent = `FPS: ${fps}`;
    }

    // Очистка canvas и зеркальное отображение
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Зеркалим изображение
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.setTransform(1, 0, 0, 1, 0, 0); // Сброс трансформации

    let angles = [90, 90, 90, 90, 90];
    let foundTargetHand = false;
    let otherHandsCount = 0;

    if (results.multiHandLandmarks && results.multiHandedness) {
        // Зеркалим координаты для рисования
        canvasCtx.save();
        canvasCtx.translate(canvasElement.width, 0);
        canvasCtx.scale(-1, 1);

        // Обрабатываем все обнаруженные руки
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i].label || results.multiHandedness[i].displayName || 'Left';
            
            // Инвертируем из-за зеркала
            const actualHand = handedness === 'Left' ? 'Right' : 'Left';
            const handName = actualHand === 'Left' ? 'Левая' : 'Правая';

            if (actualHand === targetHand) {
                // Целевая рука - зелёная
                foundTargetHand = true;
                detectedHand = handName;
                
                // Рисуем зелёный скелет
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
                drawLandmarks(canvasCtx, landmarks, {color: '#FF00FF', lineWidth: 1, radius: 5});

                // Вычисляем углы только для целевой руки
                angles = calculateAngles(landmarks);
            } else {
                // Другая рука - красная
                otherHandsCount++;
                
                // Рисуем красный скелет
                drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#FF0000', lineWidth: 2});
                drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 4});
            }
        }
        
        canvasCtx.restore();

        // Обновляем статус
        if (foundTargetHand) {
            if (otherHandsCount > 0) {
                document.getElementById('handStatus').textContent = `${detectedHand} ✓ (+${otherHandsCount})`;
                document.getElementById('handStatus').className = 'status status-success';
                
                // Показываем предупреждение о дополнительной руке
                canvasCtx.fillStyle = '#FFA500';
                canvasCtx.font = 'bold 18px Arial';
                canvasCtx.fillText(`Обнаружена ещё ${otherHandsCount} рука`, 20, canvasElement.height - 30);
            } else {
                document.getElementById('handStatus').textContent = `${detectedHand} ✓`;
                document.getElementById('handStatus').className = 'status status-success';
            }
        } else {
            // Целевая рука не найдена
            if (otherHandsCount > 0) {
                const wrongHand = targetHand === 'Left' ? 'Правая' : 'Левая';
                document.getElementById('handStatus').textContent = `${wrongHand} ✗`;
                document.getElementById('handStatus').className = 'status status-error';
                
                const targetText = targetHand === 'Left' ? 'левую' : 'правую';
                canvasCtx.fillStyle = '#FF0000';
                canvasCtx.font = 'bold 24px Arial';
                canvasCtx.fillText(`Покажите ${targetText} руку!`, 20, canvasElement.height - 30);
            } else {
                document.getElementById('handStatus').textContent = 'Нет';
                document.getElementById('handStatus').className = 'status status-warning';
            }
        }
    } else {
        document.getElementById('handStatus').textContent = 'Нет';
        document.getElementById('handStatus').className = 'status status-warning';
    }

    currentAngles = angles;
    updateAngleDisplay(angles);

    // Отправка на Arduino
    if (isTransmitting && writer) {
        sendToArduino(angles);
    }

    canvasCtx.restore();
}

// === Вычисление углов пальцев ===
function calculateAngles(landmarks) {
    const wrist = landmarks[0];
    const tips = [4, 8, 12, 16, 20];
    const mcps = [2, 5, 9, 13, 17];
    const rawAngles = [];

    for (let i = 0; i < 5; i++) {
        const tip = landmarks[tips[i]];
        const mcp = landmarks[mcps[i]];

        const distTip = Math.sqrt(
            Math.pow(tip.x - wrist.x, 2) +
            Math.pow(tip.y - wrist.y, 2) +
            Math.pow(tip.z - wrist.z, 2)
        );

        const distMcp = Math.sqrt(
            Math.pow(mcp.x - wrist.x, 2) +
            Math.pow(mcp.y - wrist.y, 2) +
            Math.pow(mcp.z - wrist.z, 2)
        );

        const ratio = distTip / (distMcp + 0.00001);

        let angle;
        if (i === 0) {
            angle = Math.round(interp(ratio, 0.9, 2.0, 0, 180));
        } else {
            angle = Math.round(interp(ratio, 0.7, 2.3, 0, 180));
        }

        angle = Math.max(0, Math.min(180, angle));
        rawAngles.push(angle);
    }

    // Сглаживание
    for (let i = 0; i < 5; i++) {
        smoothedAngles[i] = Math.round(
            smoothingFactor * rawAngles[i] + 
            (1 - smoothingFactor) * smoothedAngles[i]
        );
    }

    return smoothedAngles;
}

function interp(value, inMin, inMax, outMin, outMax) {
    value = Math.max(inMin, Math.min(inMax, value));
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

// === Обновление отображения углов ===
function updateAngleDisplay(angles) {
    for (let i = 0; i < 5; i++) {
        document.getElementById(`angle${i}`).textContent = `${angles[i]}°`;
    }
}

// === Подключение к Arduino через Web Serial API ===
async function connectSerial() {
    if (!('serial' in navigator)) {
        log('Web Serial API не поддерживается в этом браузере', 'error');
        document.getElementById('serialWarning').style.display = 'block';
        document.getElementById('serialStatus').textContent = 'Браузер не поддерживается';
        document.getElementById('serialStatus').className = 'status status-error';
        return;
    }

    try {
        if (!port) {
            log('Запрос COM-порта...', 'info');
            port = await navigator.serial.requestPort();
            
            const baudRate = parseInt(document.getElementById('baudRate').value);
            log(`Открытие порта с baudRate ${baudRate}...`, 'info');
            await port.open({ baudRate });
            
            writer = port.writable.getWriter();
            log(`✓ Arduino подключен (${baudRate} baud)`, 'success');

            document.getElementById('connectBtn').textContent = 'Отключить Arduino';
            document.getElementById('connectBtn').className = 'btn btn-danger';
            document.getElementById('serialStatus').textContent = 'Подключено';
            document.getElementById('serialStatus').className = 'status status-success';
            document.getElementById('transmitBtn').disabled = false;
            document.getElementById('serialWarning').style.display = 'none';
            document.getElementById('baudRate').disabled = true;
        } else {
            log('Отключение Arduino...', 'info');
            if (isTransmitting) toggleTransmit();
            
            if (writer) {
                writer.releaseLock();
                writer = null;
            }
            await port.close();
            port = null;
            log('✓ Arduino отключен', 'success');

            document.getElementById('connectBtn').textContent = 'Подключить Arduino';
            document.getElementById('connectBtn').className = 'btn btn-primary';
            document.getElementById('serialStatus').textContent = 'Не подключено';
            document.getElementById('serialStatus').className = 'status status-error';
            document.getElementById('transmitBtn').disabled = true;
            document.getElementById('baudRate').disabled = false;
        }
    } catch (error) {
        if (error.name === 'NotFoundError') {
            log('Выбор порта отменён пользователем', 'warning');
        } else if (error.name === 'InvalidStateError') {
            log('Ошибка: Порт занят! Закройте Arduino IDE Serial Monitor', 'error');
            alert('Ошибка: Порт занят!\n\nЗакройте:\n- Arduino IDE Serial Monitor\n- Другие программы использующие порт');
        } else if (error.name === 'NetworkError') {
            log('Ошибка: Не удалось открыть порт. Проверьте подключение Arduino', 'error');
            alert('Ошибка: Не удалось открыть порт\n\nПроверьте:\n- Arduino подключен к USB\n- Драйверы установлены');
        } else {
            log(`Ошибка подключения: ${error.message}`, 'error');
            alert('Ошибка подключения: ' + error.message + '\n\nПодробности в консоли (F12)');
        }
    }
}

// === Отправка данных на Arduino ===
let lastSentData = '';
let sendCount = 0;

async function sendToArduino(angles) {
    if (!writer) return;

    // Фильтр шума - отправляем только если изменение больше порога
    let shouldSend = false;
    for (let i = 0; i < 5; i++) {
        if (Math.abs(angles[i] - previousAngles[i]) >= minAngleChange) {
            shouldSend = true;
            break;
        }
    }

    if (!shouldSend) return; // Пропускаем отправку если изменения незначительны

    try {
        const data = angles.join(',') + '\n';
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(data));
        
        // Обновляем предыдущие значения
        previousAngles = [...angles];
        
        // Логируем только при изменении данных (чтобы не спамить)
        if (data !== lastSentData) {
            log(`→ TX: ${data.trim()}`, 'data');
            lastSentData = data;
            sendCount = 0;
        } else {
            sendCount++;
            if (sendCount % 50 === 0) { // Каждые 50 одинаковых пакетов
                log(`→ TX: ${data.trim()} (x${sendCount})`, 'data');
            }
        }
    } catch (error) {
        log(`Ошибка отправки: ${error.message}`, 'error');
    }
}

// === Включение/выключение камеры ===
async function toggleCamera() {
    if (!isCameraActive) {
        try {
            log('Инициализация MediaPipe...', 'info');
            initMediaPipe();

            log('Запуск камеры...', 'info');
            camera = new Camera(videoElement, {
                onFrame: async () => {
                    await hands.send({image: videoElement});
                },
                width: 640,
                height: 480
            });

            await camera.start();

            canvasElement.width = 640;
            canvasElement.height = 480;

            isCameraActive = true;
            document.getElementById('cameraBtn').textContent = '🎥 Выключить камеру';
            document.getElementById('cameraBtn').className = 'btn btn-danger';
            log('✓ Камера запущена (640x480)', 'success');
        } catch (error) {
            log(`Ошибка камеры: ${error.message}`, 'error');
            alert('Ошибка камеры: ' + error.message);
        }
    } else {
        log('Остановка камеры...', 'info');
        if (camera) {
            camera.stop();
            camera = null;
        }
        if (hands) {
            hands.close();
            hands = null;
        }

        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        isCameraActive = false;
        document.getElementById('cameraBtn').textContent = '🎥 Включить камеру';
        document.getElementById('cameraBtn').className = 'btn btn-primary';
        log('✓ Камера остановлена', 'success');
    }
}

// === Переключение передачи ===
function toggleTransmit() {
    isTransmitting = !isTransmitting;

    if (isTransmitting) {
        document.getElementById('transmitBtn').textContent = '⏸ Выключить передачу';
        document.getElementById('transmitBtn').className = 'btn btn-danger';
        log('✓ Передача данных включена', 'success');
    } else {
        document.getElementById('transmitBtn').textContent = '▶ Включить передачу';
        document.getElementById('transmitBtn').className = 'btn btn-warning';
        log('Передача данных выключена', 'warning');
    }
}

// === Смена руки ===
function changeHand() {
    const selected = document.querySelector('input[name="hand"]:checked').value;
    targetHand = selected;
    const handName = selected === 'Left' ? 'левая' : 'правая';
    log(`Выбрана рука: ${handName}`, 'info');
}

// === Инициализация при загрузке ===
window.addEventListener('load', () => {
    log('Приложение запущено', 'success');
    log('Готово к работе. Включите камеру для начала.', 'info');
});
