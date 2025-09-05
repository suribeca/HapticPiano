# ===== Pico W + Mosquitto (LAN) =====
# - Local-first: sensores controlan LED (VERDE) y motor sin latencia.
# - Publica cambios de estado a 'picow/fingers' (Pico -> Web).
# - Suscribe 'web/pressed' pero IGNORA color/freq por ahora (puente listo).
# - Histeresis analógica + debounce digital para evitar falsos (meñique, etc.).
# - Mapeo de motores probado: motor_mapping = [3, 4, 1, 0, 2]

import time, ujson, network
from machine import ADC, Pin, PWM
from umqtt.simple import MQTTClient

# ----------- WiFi / MQTT -----------
WIFI_SSID = ''
WIFI_PASS = ''   
BROKER_IP = ''  # <-- IP4 de PC
BROKER_PORT = 1883

TOPIC_ESTADO   = b'picow/fingers'   # Pico -> Web (telemetría booleana por dedo)
TOPIC_FEEDBACK = b'web/pressed'     # Web  -> Pico (IGNORADO por ahora)

# ----------- Sensores -----------
sensors = [
    ADC(Pin(28)),                    # Sensor 1 (analógico)
    ADC(Pin(27)),                    # Sensor 2 (analógico)
    ADC(Pin(26)),                    # Sensor 3 (analógico)
    Pin(22, Pin.IN, Pin.PULL_DOWN),  # Sensor 4 (digital)
    Pin(21, Pin.IN, Pin.PULL_DOWN)   # Sensor 5 (digital)
]

# ----------- LEDs RGB (PWM) -----------
leds = [
    [PWM(Pin(1)),  PWM(Pin(2)),  PWM(Pin(3))],     # LED 1  (R,G,B)
    [PWM(Pin(4)),  PWM(Pin(5)),  PWM(Pin(6))],     # LED 2
    [PWM(Pin(7)),  PWM(Pin(8)),  PWM(Pin(9))],     # LED 3
    [PWM(Pin(10)), PWM(Pin(11)), PWM(Pin(12))],    # LED 4
    [PWM(Pin(13)), PWM(Pin(14)), PWM(Pin(15))]     # LED 5
]
for led in leds:
    for ch in led:
        ch.freq(1000)  # 1 kHz

# ----------- Motores (salida digital) -----------
motors = [
    Pin(16, Pin.OUT),  # Motor 1 -> Index
    Pin(17, Pin.OUT),  # Motor 2 -> Middle
    Pin(18, Pin.OUT),  # Motor 3 -> Thumb
    Pin(19, Pin.OUT),  # Motor 4 -> Pinky
    Pin(20, Pin.OUT)   # Motor 5 -> Ring
]

# Posición i del sensor → índice del motor físico (mapeo ya probado)
motor_mapping = [3, 4, 1, 0, 2]

# ----------- Utilidades LED -----------
GREEN = (0, 65535, 0)  # siempre verde

def set_led_green(led):
    led[0].duty_u16(0)       # R off
    led[1].duty_u16(65535)   # G on
    led[2].duty_u16(0)       # B off

def turn_off_led(led):
    led[0].duty_u16(0); led[1].duty_u16(0); led[2].duty_u16(0)

# ----------- Filtro de entrada -----------
# Histeresis para analógicos: sube con THRESH_ON y baja con THRESH_OFF
THRESH_ON  = 30000
THRESH_OFF = 26000
analog_state = [False, False, False]  # estado latched por canal analógico

# Debounce muy simple para digitales
DEBOUNCE_MS = 20
last_change_ms = [0, 0]  # para los 2 digitales (índices 3 y 4)
digital_state = [False, False]  # estado estable de digitales

def read_pressed_list():
    """Devuelve lista de 5 bool con histeresis/debounce aplicados."""
    pressed = [False]*5

    # Analógicos con histeresis
    for i in range(3):
        raw = sensors[i].read_u16()
        if analog_state[i]:
            # ya estaba ON -> sólo apaga si baja por debajo de OFF
            analog_state[i] = raw > THRESH_OFF
        else:
            # estaba OFF -> sólo enciende si supera ON
            analog_state[i] = raw > THRESH_ON
        pressed[i] = analog_state[i]

    # Digitales con debounce
    now = time.ticks_ms()
    for j in range(2):
        idx = 3 + j
        val = sensors[idx].value() == 1
        if val != digital_state[j]:
            # cambió: validar debounce
            if time.ticks_diff(now, last_change_ms[j]) >= DEBOUNCE_MS:
                digital_state[j] = val
                last_change_ms[j] = now
        pressed[idx] = digital_state[j]

    return pressed

# ----------- MQTT (suscripción opcional) -----------
# Dejamos el callback listo, pero no alteramos LED/motores para mantener baja latencia.
def on_mqtt_message(topic, msg):
    # Estructura esperada (si algún día quieres reactivar):
    # {"thumb":{"pressed":true,"color":"#00ff00","freq":50000}, ...}
    # Por ahora, lo ignoramos a propósito para que nada meta latencia.
    pass

def wifi_connect():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Conectando WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        while not wlan.isconnected():
            time.sleep(0.1)
    print("WiFi:", wlan.ifconfig())

def mqtt_connect():
    c = MQTTClient(client_id=b'PicoClient',
                   server=BROKER_IP, port=BROKER_PORT,
                   user=None, password=None,
                   keepalive=30, ssl=False)
    c.set_callback(on_mqtt_message)
    c.connect()
    c.subscribe(TOPIC_FEEDBACK)
    print("MQTT conectado:", BROKER_IP)
    return c

# Publicar sólo si cambió el estado (menos tráfico)
last_pressed = [False]*5
def publish_states_if_changed(client, pressed):
    global last_pressed
    if pressed != last_pressed:
        payload = {
            # mismo mapeo “LED1..LED5 ↔ pinky, ring, middle, index, thumb”
            "pinky":  bool(pressed[0]),
            "ring":   bool(pressed[1]),
            "middle": bool(pressed[2]),
            "index":  bool(pressed[3]),
            "thumb":  bool(pressed[4]),
        }
        try:
            client.publish(TOPIC_ESTADO, ujson.dumps(payload))
        except Exception as e:
            # Si falla la publi, seguimos con lazo local (no afectamos hápticos)
            print("MQTT publish error:", e)
        last_pressed = pressed[:]

# ----------- Main -----------
wifi_connect()
client = mqtt_connect()

LOOP_DT = 0.02  # 20 ms: respuesta rápida pero estable
PUB_MS  = 80    # publicar máx ~12.5 Hz
t_pub   = time.ticks_ms()

while True:
    # Procesa tráfico MQTT entrante sin bloquear
    try:
        client.check_msg()
    except Exception as e:
        # Intento simple de reconexión si algo pasa
        print("MQTT check_msg error:", e)
        try:
            client = mqtt_connect()
        except Exception as e2:
            print("MQTT reconnection failed:", e2)

    # Lectura de sensores (con filtros) y accionamiento local inmediato
    pressed = read_pressed_list()

    for i in range(5):
        motor_idx = motor_mapping[i]
        if pressed[i]:
            set_led_green(leds[i])
            motors[motor_idx].value(1)
        else:
            turn_off_led(leds[i])
            motors[motor_idx].value(0)

    # Telemetría si cambió algo (sin bloquear lazo)
    if time.ticks_diff(time.ticks_ms(), t_pub) >= PUB_MS:
        publish_states_if_changed(client, pressed)
        t_pub = time.ticks_ms()

    time.sleep(LOOP_DT)
