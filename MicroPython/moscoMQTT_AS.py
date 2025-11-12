# ================================================================
# Haptic Glove - MQTT_AS + Medición de Latencia (Modo Access Point)
# ================================================================

import ujson, uasyncio as asyncio, time, network
from machine import ADC, Pin, PWM
from mqtt_as import MQTTClient, config

# ================================
# CONFIGURACIÓN WIFI
# ================================

AP_SSID = "HapticGlove"
AP_PASSWORD = "12345678"
AP_IP = "192.168.4.1"
BROKER_IP = "192.168.4.16"   # IP de tu PC cuando se conecta al AP
BROKER_PORT = 1883

TOPIC_ESTADO   = b"picow/fingers"
TOPIC_FEEDBACK = b"web/pressed"

# ================================
# HARDWARE
# ================================

sensors = [
    ADC(Pin(28)), ADC(Pin(27)), ADC(Pin(26)),
    Pin(22, Pin.IN, Pin.PULL_DOWN), Pin(21, Pin.IN, Pin.PULL_DOWN)
]

leds = [
    [Pin(1, Pin.OUT), Pin(2, Pin.OUT), Pin(3, Pin.OUT)],      # Pinky
    [Pin(4, Pin.OUT), Pin(5, Pin.OUT), Pin(6, Pin.OUT)],      # Ring
    [Pin(7, Pin.OUT), Pin(8, Pin.OUT), Pin(9, Pin.OUT)],      # Middle
    [Pin(10, Pin.OUT), Pin(11, Pin.OUT), Pin(12, Pin.OUT)],   # Index
    [Pin(13, Pin.OUT), Pin(14, Pin.OUT), Pin(15, Pin.OUT)]    # Thumb
]

motors = [PWM(Pin(19)), PWM(Pin(20)), PWM(Pin(17)), PWM(Pin(16)), PWM(Pin(18))]

for m in motors:
    m.freq(1000)

THRESH_ON, THRESH_OFF = 20000, 1000
analog_state = [False]*3
digital_state = [False]*2
last_change_ms = [0]*2
DEBOUNCE_MS = 20

# ================================
# MEDICIÓN DE LATENCIA
# ================================

finger_timestamps = {}
latency_stats = {"count": 0, "sum": 0, "min": None, "max": None, "last": None}

def record_finger_press(finger):
    finger_timestamps[finger] = time.ticks_ms()

def calculate_latency(finger):
    if finger not in finger_timestamps:
        return None
    send_time = finger_timestamps.pop(finger)
    latency = time.ticks_diff(time.ticks_ms(), send_time)
    s = latency_stats
    s["count"] += 1
    s["sum"] += latency
    s["last"] = latency
    s["min"] = latency if s["min"] is None or latency < s["min"] else s["min"]
    s["max"] = latency if s["max"] is None or latency > s["max"] else s["max"]
    print(f"[LATENCIA] {finger}: {latency} ms")
    return latency

# ================================
# UTILIDADES
# ================================

def set_led_color(led, r, g, b):
    led[0].value(r); led[1].value(g); led[2].value(b)

def turn_off_led(led):
    set_led_color(led, 0, 0, 0)

def hex_to_bin_rgb(hex_color):
    h = hex_color.lstrip("#")
    return tuple(1 if int(h[i:i+2],16)>127 else 0 for i in (0,2,4))

def finger_to_index(f):
    return {"pinky":0,"ring":1,"middle":2,"index":3,"thumb":4}.get(f)

# ================================
# WIFI ACCESS POINT
# ================================

def wifi_ap_mode():
    print("[WIFI] Activando Access Point...")
    wlan_sta = network.WLAN(network.STA_IF)
    wlan_sta.active(False)
    ap = network.WLAN(network.AP_IF)
    ap.config(essid=AP_SSID, password=AP_PASSWORD)
    ap.ifconfig((AP_IP, "255.255.255.0", AP_IP, "8.8.8.8"))
    ap.active(True)
    while not ap.active():
        time.sleep(0.1)
    print(f"[WIFI] AP activo en {ap.ifconfig()[0]}")
    return ap

# ================================
# MQTT CALLBACK
# ================================

async def on_mqtt_message(topic, msg, retained):
    try:
        data = ujson.loads(msg)
        for finger, info in data.items():
            if not isinstance(info, dict):
                continue
            pressed = info.get("pressed", False)
            color = info.get("color", "#000000")
            freq = int(info.get("freq", 0))
            i = finger_to_index(finger)
            if i is None:
                continue
            if pressed:
                calculate_latency(finger)
                r,g,b = hex_to_bin_rgb(color)
                set_led_color(leds[i], r,g,b)
                motors[i].duty_u16(freq)
            else:
                turn_off_led(leds[i])
                motors[i].duty_u16(0)
    except Exception as e:
        print("[ERROR MQTT]:", e)

# ================================
# MQTT CONFIGURACIÓN ASÍNCRONA
# ================================

wifi_ap_mode()

config["ssid"] = AP_SSID
config["wifi_pw"] = AP_PASSWORD
config["server"] = BROKER_IP
config["port"] = BROKER_PORT
config["subs_cb"] = on_mqtt_message
config["connect_coro"] = None
config["client_id"] = b"HapticPico"
config["keepalive"] = 30

mqtt_client = MQTTClient(config)

# ================================
# LECTURA DE SENSORES
# ================================

def read_sensors():
    pressed = [False]*5
    for i in range(3):
        raw = sensors[i].read_u16()
        if analog_state[i]:
            analog_state[i] = raw > THRESH_OFF
        else:
            analog_state[i] = raw > THRESH_ON
        pressed[i] = analog_state[i]
    now = time.ticks_ms()
    for j in range(2):
        idx = 3 + j
        val = sensors[idx].value() == 1
        if val != digital_state[j] and time.ticks_diff(now,last_change_ms[j])>=DEBOUNCE_MS:
            digital_state[j] = val
            last_change_ms[j] = now
        pressed[idx] = digital_state[j]
    return pressed

# ================================
# LOOP PRINCIPAL ASÍNCRONO
# ================================

async def sensor_loop():
    last_pressed = [False]*5
    finger_names = ["pinky","ring","middle","index","thumb"]
    while True:
        pressed = read_sensors()
        if pressed != last_pressed:
            payload = {f: pressed[i] for i,f in enumerate(finger_names)}
            for i,f in enumerate(finger_names):
                if pressed[i] and not last_pressed[i]:
                    record_finger_press(f)
            try:
                await mqtt_client.publish(TOPIC_ESTADO, ujson.dumps(payload), qos=0)
            except Exception as e:
                print("[MQTT Publish Error]:", e)
            last_pressed = pressed[:]
        await asyncio.sleep_ms(20)

# ================================
# MAIN
# ================================

async def main():
    await mqtt_client.connect()
    await mqtt_client.subscribe(TOPIC_FEEDBACK, 0)
    print("[MAIN] Conectado al broker, iniciando tareas...")
    asyncio.create_task(sensor_loop())
    while True:
        await asyncio.sleep(5)

try:
    asyncio.run(main())
finally:
    mqtt_client.close()
