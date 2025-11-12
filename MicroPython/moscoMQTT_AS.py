# Haptic Glove - ULTRA OPTIMIZADO para latencia mínima
# Versión compacta y rápida sin dependencias externas
import time, ujson, network, gc
from machine import ADC, Pin, PWM
from umqtt.simple import MQTTClient

# ================================
# CONFIGURACIÓN
# ================================
AP_SSID, AP_PASSWORD, AP_IP = "HapticGlove", "12345678", "192.168.4.1"
BROKER_IP, BROKER_PORT = '192.168.4.16', 1883
TOPIC_ESTADO, TOPIC_FEEDBACK = b'picow/fingers', b'web/pressed'

# Hardware
sensors = [ADC(Pin(28)), ADC(Pin(27)), ADC(Pin(26)), Pin(22, Pin.IN, Pin.PULL_DOWN), Pin(21, Pin.IN, Pin.PULL_DOWN)]
leds = [[Pin(i, Pin.OUT) for i in range(j, j+3)] for j in [1, 4, 7, 10, 13]]
motors = [PWM(Pin(p)) for p in [19, 20, 17, 16, 18]]

# Calibración
THRESH_ON, THRESH_OFF, DEBOUNCE_MS = 20000, 1000, 20
analog_state, digital_state, last_change_ms = [False]*3, [False]*2, [0]*2

# Latencia
finger_timestamps, latency_stats = {}, {"count": 0, "sum": 0, "min": None, "max": None, "last": None}
FINGER_MAP = {"pinky": 0, "ring": 1, "middle": 2, "index": 3, "thumb": 4}

# ================================
# FUNCIONES CORE (inline donde sea posible)
# ================================

def init_hw():
    """Inicialización de hardware"""
    for m in motors: m.freq(1000)
    gc.collect()

def set_led(led, r, g, b):
    led[0].value(r); led[1].value(g); led[2].value(b)

def hex_to_rgb(h):
    """Conversión rápida hex a RGB binario"""
    h = h.lstrip('#')
    return (1 if int(h[0:2], 16) > 127 else 0, 
            1 if int(h[2:4], 16) > 127 else 0, 
            1 if int(h[4:6], 16) > 127 else 0)

def read_sensors():
    """Lectura optimizada de sensores"""
    pressed = [False]*5
    
    # Analógicos con histeresis
    for i in range(3):
        raw = sensors[i].read_u16()
        analog_state[i] = raw > (THRESH_OFF if analog_state[i] else THRESH_ON)
        pressed[i] = analog_state[i]
    
    # Digitales con debounce
    now = time.ticks_ms()
    for j in range(2):
        idx = 3 + j
        val = sensors[idx].value()
        if val != digital_state[j] and time.ticks_diff(now, last_change_ms[j]) >= DEBOUNCE_MS:
            digital_state[j] = val
            last_change_ms[j] = now
        pressed[idx] = digital_state[j]
    
    return pressed

def calc_latency(finger):
    """Cálculo rápido de latencia"""
    if finger not in finger_timestamps:
        return None
    
    lat = time.ticks_diff(time.ticks_ms(), finger_timestamps[finger])
    
    s = latency_stats
    s["count"] += 1
    s["sum"] += lat
    s["last"] = lat
    s["min"] = lat if s["min"] is None or lat < s["min"] else s["min"]
    s["max"] = lat if s["max"] is None or lat > s["max"] else s["max"]
    
    del finger_timestamps[finger]
    return lat

def print_stats():
    """Impresión compacta de estadísticas"""
    s = latency_stats
    if s["count"] > 0:
        print(f"LAT: last={s['last']}ms avg={s['sum']/s['count']:.1f}ms min={s['min']}ms max={s['max']}ms n={s['count']}")
        s.update({"count": 0, "sum": 0, "min": None, "max": None})

# ================================
# MQTT OPTIMIZADO
# ================================

def on_msg(topic, msg):
    """Handler MQTT ultra-rápido"""
    try:
        data = ujson.loads(msg)
        
        if "__empty" in data:
            for i in range(5):
                set_led(leds[i], 0, 0, 0)
                motors[i].duty_u16(0)
            return
        
        for finger, info in data.items():
            idx = FINGER_MAP.get(finger)
            if idx is None: continue
            
            # Parsing rápido
            if isinstance(info, dict):
                pressed, color, freq = info.get("pressed", False), info.get("color", "#000000"), info.get("freq", 0)
            else:
                pressed, color, freq = bool(info), "#000000", 0
            
            # Latencia
            if pressed:
                lat = calc_latency(finger)
                if lat: print(f"[LAT] {finger}: {lat}ms")
            
            # Actualizar hardware
            if pressed:
                r, g, b = hex_to_rgb(color)
                set_led(leds[idx], r, g, b)
                motors[idx].duty_u16(freq if isinstance(freq, int) else 0)
            else:
                set_led(leds[idx], 0, 0, 0)
                motors[idx].duty_u16(0)
    except Exception as e:
        print(f"[ERR] {e}")

def mqtt_connect():
    """Conexión MQTT con reintentos"""
    for i in range(5):
        try:
            c = MQTTClient(b'PicoClient', BROKER_IP, BROKER_PORT, keepalive=60)
            c.set_callback(on_msg)
            c.connect()
            c.subscribe(TOPIC_FEEDBACK, qos=0)
            print("[MQTT] OK")
            return c
        except Exception as e:
            print(f"[MQTT] Err #{i+1}: {e}")
            time.sleep(2)
    return None

def pub_state(client, pressed, last):
    """Publicación optimizada"""
    if not client or pressed == last: return last
    
    ts = time.ticks_ms()
    fingers = ["pinky", "ring", "middle", "index", "thumb"]
    
    # Payload mínimo
    payload = {f: pressed[i] for i, f in enumerate(fingers)}
    
    # Registrar timestamps de flancos de subida
    for i, f in enumerate(fingers):
        if pressed[i] and not last[i]:
            finger_timestamps[f] = ts
    
    try:
        client.publish(TOPIC_ESTADO, ujson.dumps(payload), qos=0)
    except Exception as e:
        print(f"[PUB] {e}")
    
    return pressed[:]

# ================================
# WIFI
# ================================

def wifi_setup():
    """Configuración WiFi optimizada"""
    network.WLAN(network.STA_IF).active(False)
    
    ap = network.WLAN(network.AP_IF)
    # Solo parámetros básicos soportados en Pico W AP
    ap.config(essid=AP_SSID, password=AP_PASSWORD)
    ap.ifconfig((AP_IP, "255.255.255.0", AP_IP, "8.8.8.8"))
    ap.active(True)
    
    time.sleep(1)
    while not ap.active(): time.sleep(0.1)
    
    print(f"[WIFI] AP: {AP_SSID} @ {ap.ifconfig()[0]}")
    return ap

def startup():
    """Test rápido de LEDs y motores"""
    print("[TEST] HW...")
    for i, led in enumerate(leds):
        set_led(led, 1, 0, 0); motors[i].duty_u16(15000); time.sleep(0.1)
        set_led(led, 0, 0, 0); motors[i].duty_u16(0); time.sleep(0.05)
    print("[TEST] OK")

# ================================
# MAIN LOOP
# ================================

def main():
    print("=== HAPTIC GLOVE (ULTRA-OPT) ===")
    
    init_hw()
    startup()
    wifi_setup()
    client = mqtt_connect()
    
    if not client:
        print("[FATAL] No MQTT")
        return
    
    last_pressed = [False]*5
    
    # Timing ultra-agresivo
    LOOP_MS, PUB_MS, STATS_MS = 3, 25, 10000
    t_pub, t_stats = time.ticks_ms(), time.ticks_ms()
    
    print(f"[RUN] Loop:{LOOP_MS}ms Pub:{PUB_MS}ms")
    
    # Loop principal - máxima eficiencia
    while True:
        now = time.ticks_ms()
        
        # MQTT primero
        try:
            client.check_msg()
        except:
            client = mqtt_connect()
        
        # Sensores
        pressed = read_sensors()
        
        # Publicar
        if time.ticks_diff(now, t_pub) >= PUB_MS:
            last_pressed = pub_state(client, pressed, last_pressed)
            t_pub = now
        
        # Stats
        if time.ticks_diff(now, t_stats) >= STATS_MS:
            print_stats()
            t_stats = now
            gc.collect()  # Liberar memoria periódicamente
        
        time.sleep(LOOP_MS / 1000.0)

if __name__ == "__main__":
    main()