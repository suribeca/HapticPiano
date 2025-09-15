# Haptic Glove - Mosquitto Mqtt
# Firmware para controlar sensores, LEDs y motores  
import time, ujson, network
from machine import ADC, Pin, PWM
from umqtt.simple import MQTTClient

# ================================
# Configuración del sistema
# ================================

# ----------- WiFi Access Point -----------
AP_SSID = "PICO2C7F" #Nombre por defecto
AP_PASSWORD = "12345678"
AP_IP = "192.168.4.1"

 # -------- MQTT ---------------
BROKER_IP = '192.168.4.16'  # IP de tu PC cuando se conecte al AP
BROKER_PORT = 1883

TOPIC_ESTADO   = b'picow/fingers'   # Pico -> Web (telemetría booleana por dedo)
TOPIC_FEEDBACK = b'web/pressed'     # Web  -> Pico (IGNORADO por ahora)

# ----------- Sensores -----------
sensors = [
    ADC(Pin(28)),                    # Sensor 1: analógico
    ADC(Pin(27)),                    # Sensor 2: analógico
    ADC(Pin(26)),                    # Sensor 3: analógico
    Pin(22, Pin.IN, Pin.PULL_DOWN),  # Sensor 4: digital
    Pin(21, Pin.IN, Pin.PULL_DOWN)   # Sensor 5: digital
]

# ----------- LEDs RGB (PWM) -----------
leds = [
    [PWM(Pin(1)),  PWM(Pin(2)),  PWM(Pin(3))],     # LED 1  (R,G,B)
    [PWM(Pin(4)),  PWM(Pin(5)),  PWM(Pin(6))],     # LED 2
    [PWM(Pin(7)),  PWM(Pin(8)),  PWM(Pin(9))],     # LED 3
    [PWM(Pin(10)), PWM(Pin(11)), PWM(Pin(12))],    # LED 4
    [PWM(Pin(13)), PWM(Pin(14)), PWM(Pin(15))]     # LED 5
]

# ----------- Motores (salida digital) -----------
motors = [
    Pin(16, Pin.OUT),  # Motor 1: Index
    Pin(17, Pin.OUT),  # Motor 2: Middle
    Pin(18, Pin.OUT),  # Motor 3: Thumb
    Pin(19, Pin.OUT),  # Motor 4: Pinky
    Pin(20, Pin.OUT)   # Motor 5: Ring
]

motor_mapping = [3, 4, 1, 0, 2] # Sensor -> Motor


# ----------- Filtros de entrada -----------
# Histeresis y Debounce
THRESH_ON, THRESH_OFF  = 30000, 26000
analog_state = [False]*3  # estado latched por canal analógico
digital_state = [False]*2  # estado estable de digitales
last_change_ms = [0]*2  # para los 2 digitales (índices 3 y 4)
DEBOUNCE_MS = 20


#===============================
# Utilidades de lectura de sensores
#===============================

def init_leds():
    """Configura frecuencia PWM para todos los LEDs."""
    for led in leds:
        for ch in led:
            ch.freq(1000)

def set_led_green(led):
    """Enciende un LED en color verde."""
    led[0].duty_u16(0)
    led[1].duty_u16(65535)
    led[2].duty_u16(0)

def turn_off_led(led):
    """Apaga un LED RGB."""
    for ch in led:
        ch.duty_u16(0)


# =============================
# Filtrado de sensores
# ==============================

def read_sensors():
    """Lectura de sensores aplicando histeresis y debounce. Devuelve lista de 5 bool."""
    pressed = [False]*5

    # --- Analógicos con histeresis ---
    for i in range(3):
        raw = sensors[i].read_u16()
        if analog_state[i]:
            analog_state[i] = raw > THRESH_OFF
        else:
            analog_state[i] = raw > THRESH_ON
        pressed[i] = analog_state[i]

    # --- Digitales con debounce ---
    now = time.ticks_ms()
    for j in range(2):
        idx = 3 + j
        val = sensors[idx].value() == 1
        if val != digital_state[j] and time.ticks_diff(now, last_change_ms[j]) >= DEBOUNCE_MS:
            digital_state[j] = val
            last_change_ms[j] = now
        pressed[idx] = digital_state[j]

    return pressed

# =============================
# MQTT
# =============================

def on_mqtt_message(topic, msg):
    """Callback para mensajes entrantes."""
    # Estructura esperada (si algún día quieres reactivar):
    # {"thumb":{"pressed":true,"color":"#00ff00","freq":50000}, ...}
    try:
        print(f"[MQTT] Mensaje recibido en {topic}:{msg}")
    except:
        pass

def mqtt_connect():
    """Conecta al broker MQTT con reintentos"""
    max_attempts = 5
    for attempt in range(max_attempts):
        try:
            print(f"Conectando MQTT a {BROKER_IP} (intento {attempt + 1}/{max_attempts})...")
            c = MQTTClient(client_id=b'PicoClient',
                           server=BROKER_IP, port=BROKER_PORT,
                           user=None, password=None,
                           keepalive=60, ssl=False)
            c.set_callback(on_mqtt_message)
            c.connect()
            c.subscribe(TOPIC_FEEDBACK)
            print("[MQTT] Conectado exitosamente.")
            return c
        except Exception as e:
            print(f"[MQTT] Error: {e}")
            time.sleep(3)
    print(" [MQTT] Conexión fallida después de varios intentos.")
    return None


def publish_states_if_changed(client, pressed, last_pressed):
    """Publica el estado de los dedos si hubo cambios."""
    if not client or pressed == last_pressed:
        return last_pressed

    payload = {
        "pinky":  pressed[0],
        "ring":   pressed[1],
        "middle": pressed[2],
        "index":  pressed[3],
        "thumb":  pressed[4],
        "timestamp": time.ticks_ms()
    }
    try:
        client.publish(TOPIC_ESTADO, ujson.dumps(payload))
        print(f"[MQTT] Estado publicado: {payload}")
    except Exception as e:
        print(f"[MQTT] Error publicando: {e}")

    return pressed[:]

# =============================
# Configuración WiFi Access Point
# =============================

def wifi_ap_mode():
    """Configura el Pico W como Access Point"""
    print("[WIFI] Configurando Access Point...")
    
    # Desactivar modo cliente
    wlan_sta = network.WLAN(network.STA_IF)
    wlan_sta.active(False)
    
    # Configurar Access Point
    ap = network.WLAN(network.AP_IF)
    ap.active(True)
    time.sleep(1)

    ap.config(
        essid=AP_SSID,
        password=AP_PASSWORD)
    ap.ifconfig((AP_IP, "255.255.255.0", AP_IP, "8.8.8.8"))
    
    print(f"[WIFI] AP '{AP_SSID}' activo en {ap.ifconfig()[0]}")

    # Verificar que esté activo
    timeout = 8
    start_time = time.time()
    while not ap.active():
        if time.time() - start_time > timeout:
            raise Exception("No se pudo activar Access Point")
        time.sleep(0.5)
    
    config = ap.ifconfig()
    print("=== ACCESS POINT ACTIVO ===")
    print(f"SSID: '{AP_SSID}'")
    print(f"Password: '{AP_PASSWORD}'")
    print(f"IP del Pico: {config[0]}")
    print(f"Rango DHCP: 192.168.4.2-192.168.4.10")
    print("¡Conecta tu PC a esta red WiFi!")
    print("===============================")
    
    return ap

# ================================================================
# PATRÓN DE INICIO
# ================================================================

def startup_pattern():
    """Patrón de inicio - confirma que el hardware funciona"""
    print("Iniciando patrón de LEDs...")
    for cycle in range(3):
        # Encender todos los LEDs en verde
        for led in leds:
            set_led_green(led)
        # Activar todos los motores brevemente
        for motor in motors:
            motor.value(1)
        time.sleep(0.3)
        
        # Apagar todo
        for led in leds:
            turn_off_led(led)
        for motor in motors:
            motor.value(0)
        time.sleep(0.3)
    print("Patrón completado - Hardware OK")

# ================================
# MAIN
# ================================
def main():
    print("=== INICIANDO HAPTIC GLOVE ===")
    init_leds()
    startup_pattern()

    wifi_ap_mode()
    client = mqtt_connect()

    last_pressed = [False]*5
    LOOP_DT, PUB_MS = 0.02, 100
    t_pub = time.ticks_ms()

    print("[MAIN] Sistema en ejecución.")
    while True:
        # Leer sensores
        pressed = read_sensors()

        # Control inmediato
        for i in range(5):
            motor_idx = motor_mapping[i]
            if pressed[i]:
                set_led_green(leds[i])
                motors[motor_idx].value(1)
            else:
                turn_off_led(leds[i])
                motors[motor_idx].value(0)

        # Publicar cambios
        if time.ticks_diff(time.ticks_ms(), t_pub) >= PUB_MS:
            last_pressed = publish_states_if_changed(client, pressed, last_pressed)
            t_pub = time.ticks_ms()

        time.sleep(LOOP_DT)

# ================================================================
# ENTRY POINT
# ================================================================

if __name__ == "__main__":
    main()