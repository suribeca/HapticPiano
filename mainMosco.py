# ===== Pico W + Mosquitto (LAN) =====
# - Mismo cableado y mapeo probado
# - LED/Motor se activan al instante por sensor físico (verde por defecto)
# - Publica estados:  picow/fingers
# - Recibe color/intensidad opcional: web/pressed  (freq = duty 0..65535)

import time, ujson, network
from machine import ADC, Pin, PWM
from umqtt.simple import MQTTClient

# ---------- WiFi / MQTT ----------
WIFI_SSID = ''
WIFI_PASS = ''      
BROKER_IP = '192.168.XXX.X'      # <-- IP 
BROKER_PORT = 1883

TOPIC_ESTADO   = b'picow/fingers'   # Pico -> Web (estado dedos)
TOPIC_FEEDBACK = b'web/pressed'     # Web  -> Pico (color/intensidad)

# ---------- Sensores ----------
sensors = [
    ADC(Pin(28)),                    # Sensor 1 (analógico)
    ADC(Pin(27)),                    # Sensor 2 (analógico)
    ADC(Pin(26)),                    # Sensor 3 (analógico)
    Pin(22, Pin.IN, Pin.PULL_DOWN),  # Sensor 4 (digital)
    Pin(21, Pin.IN, Pin.PULL_DOWN)   # Sensor 5 (digital)
]

# ---------- LEDs RGB ----------
leds = [
    [PWM(Pin(1)),  PWM(Pin(2)),  PWM(Pin(3))],     # LED 1
    [PWM(Pin(4)),  PWM(Pin(5)),  PWM(Pin(6))],     # LED 2
    [PWM(Pin(7)),  PWM(Pin(8)),  PWM(Pin(9))],     # LED 3
    [PWM(Pin(10)), PWM(Pin(11)), PWM(Pin(12))],    # LED 4
    [PWM(Pin(13)), PWM(Pin(14)), PWM(Pin(15))]     # LED 5
]
for led in leds:
    for ch in led:
        ch.freq(1000)

# ---------- Motores (PWM) ----------
motors = [
    PWM(Pin(16)),  # Motor 1 -> Index
    PWM(Pin(17)),  # Motor 2 -> Middle
    PWM(Pin(18)),  # Motor 3 -> Thumb
    PWM(Pin(19)),  # Motor 4 -> Pinky
    PWM(Pin(20))   # Motor 5 -> Ring
]
for m in motors:
    m.freq(1000)

# Posición i del sensor → índice del motor físico (mapeo probado)
motor_mapping = [3, 4, 1, 0, 2]

# ---------- Dedo ↔ sensor (como usabas antes) ----------
# LED1..LED5 ↔ pinky, ring, middle, index, thumb
sensor_to_finger = ["pinky", "ring", "middle", "index", "thumb"]
finger_to_sensor_index = {name: i for i, name in enumerate(sensor_to_finger)}

# ---------- Utilidades ----------
GREEN = (0, 65535, 0)    # LED verde por defecto
THRESH = 30000           # Umbral para analógicos
DEFAULT_DUTY = 45000     # Intensidad base

def set_led_color(led, rgb):
    r,g,b = rgb
    led[0].duty_u16(r); led[1].duty_u16(g); led[2].duty_u16(b)

def turn_off_led(led):
    set_led_color(led, (0,0,0))

def pressure_to_duty(raw):
    # raw 0..65535  -> duty 30000..65535 (aprox)
    if raw < THRESH:
        return 0
    span = 65535 - THRESH
    duty = 30000 + int((raw - THRESH) * (35535 / span))
    return 65535 if duty > 65535 else duty

def hex_to_rgb65535(h):
    h = h.lstrip('#')
    return (int(h[0:2],16)*257, int(h[2:4],16)*257, int(h[4:6],16)*257)

def read_pressed_list():
    pressed = [False]*5
    for i in range(5):
        if i < 3:
            pressed[i] = sensors[i].read_u16() > THRESH
        else:
            pressed[i] = (sensors[i].value() == 1)
    return pressed

# ---------- Estado deseado desde la web ----------
# Si la web no manda nada: LED verde + duty por presión
desired_color = [(0,0,0)]*5   # (0,0,0) = usa GREEN por defecto
desired_duty  = [0]*5         # 0 = usa pressure_to_duty o DEFAULT_DUTY

# ---------- MQTT ----------
def on_mqtt_message(topic, msg):
    # Espera: {"thumb":{"color":"#00ff00","freq":50000}, ...}
    try:
        data = ujson.loads(msg)
        for finger, info in data.items():
            si = finger_to_sensor_index.get(finger, None)
            if si is None: 
                continue
            color = info.get("color", "#000000")
            freq  = info.get("freq", 0)
            if not isinstance(freq, int):
                freq = 0
            desired_color[si] = hex_to_rgb65535(color)
            desired_duty[si]  = max(0, min(freq, 65535))
    except Exception as e:
        print("MQTT parse error:", e)

def wifi_connect():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print("Conectando WiFi...")
        wlan.connect(WIFI_SSID, WIFI_PASS)
        while not wlan.isconnected():
            time.sleep(0.2)
    print("WiFi:", wlan.ifconfig())

def mqtt_connect():
    c = MQTTClient(client_id=b'PicoClient',
                   server=BROKER_IP, port=BROKER_PORT,
                   user=None, password=None,
                   keepalive=60, ssl=False)
    c.set_callback(on_mqtt_message)
    c.connect()
    c.subscribe(TOPIC_FEEDBACK)
    print("MQTT conectado:", BROKER_IP)
    return c

# Publica estados solo cuando cambian (menos tráfico)
last_pressed = [False]*5
def publish_states_if_changed(client, pressed):
    global last_pressed
    if pressed != last_pressed:
        payload = { sensor_to_finger[i]: bool(pressed[i]) for i in range(5) }
        try:
            client.publish(TOPIC_ESTADO, ujson.dumps(payload))
        except Exception as e:
            print("MQTT publish error:", e)
        last_pressed = pressed[:]

# ---------- Main ----------
wifi_connect()
client = mqtt_connect()

LOOP_DT = 0.02     # 20 ms para baja latencia
PUB_MS  = 80       # publicar como máx ~12.5 Hz si cambió
t_pub   = time.ticks_ms()

while True:
    client.check_msg()                 # procesa MQTT entrante

    pressed = read_pressed_list()      # lee sensores

    for i in range(5):
        motor_idx = motor_mapping[i]
        if pressed[i]:
            # LED: color web si lo mandan, si no, VERDE
            rgb = desired_color[i] if desired_color[i] != (0,0,0) else GREEN
            set_led_color(leds[i], rgb)

            # Motor: duty web si lo mandan (>0), si no por presión (o base en digitales)
            if i < 3:
                raw = sensors[i].read_u16()
                duty = desired_duty[i] if desired_duty[i] > 0 else pressure_to_duty(raw) or DEFAULT_DUTY
            else:
                duty = desired_duty[i] if desired_duty[i] > 0 else DEFAULT_DUTY
            motors[motor_idx].duty_u16(duty)
        else:
            turn_off_led(leds[i])
            motors[motor_idx].duty_u16(0)

    # Telemetría a la web si cambió algo
    if time.ticks_diff(time.ticks_ms(), t_pub) >= PUB_MS:
        publish_states_if_changed(client, pressed)
        t_pub = time.ticks_ms()

    time.sleep(LOOP_DT)

