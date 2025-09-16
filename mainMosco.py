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
    [Pin(1, Pin.OUT), Pin(2, Pin.OUT), Pin(3, Pin.OUT)],      # LED 1: Pinky
    [Pin(4, Pin.OUT), Pin(5, Pin.OUT), Pin(6, Pin.OUT)],      # LED 2: Ring
    [Pin(7, Pin.OUT), Pin(8, Pin.OUT), Pin(9, Pin.OUT)],      # LED 3: Middle
    [Pin(10, Pin.OUT), Pin(11, Pin.OUT), Pin(12, Pin.OUT)],   # LED 4: Index
    [Pin(13, Pin.OUT), Pin(14, Pin.OUT), Pin(15, Pin.OUT)]    # LED 5: Thumb
]

# ----------- Motores (salida digital) -----------

motors = [
    PWM(Pin(19)),  # Motor 4: Pinky
    PWM(Pin(20)),   # Motor 5: Ring
    PWM(Pin(17)),  # Motor 2: Middle
    PWM(Pin(16)),  # Motor 1: Index
    PWM(Pin(18))  # Motor 3: Thumb
]

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

            
def init_motors():
    """Configura frecuencia PWM para todos los motores."""
    for motor in motors:
            motor.freq(1000)

def set_led_color(led, r, g, b):
    """Enciende un LED en el color indicado."""
    led[0].value(r)
    led[1].value(g)
    led[2].value(b)

def turn_off_led(led):
    """Apaga LED"""
    set_led_color(led, 0, 0, 0)

#Código de legado
def hex_to_rgb565(hex_color): 
    """Convierte un color hexadecimal #RRGGBB a tupla (r,g,b) en rango 0-65535."""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) * 257
    g = int(hex_color[2:4], 16) * 257
    b = int(hex_color[4:6], 16) * 257
    return (r, g, b)

def hex_to_bin_rgb(hex_color):
    """Convierte un color hexadecimal #RRGGBB a tupla binaria (r,g,b) 0/1"""
    hex_color = hex_color.lstrip('#')
    r = 1 if int(hex_color[0:2], 16) > 127 else 0
    g = 1 if int(hex_color[2:4], 16) > 127 else 0
    b = 1 if int(hex_color[4:6], 16) > 127 else 0
    return (r, g, b)

def finger_to_led_index(finger):
    """Mapea nombre de dedo a índice de LED/motor."""
    return {
        "pinky":  0,  # LED1
        "ring":   1,  # LED2
        "middle": 2,  # LED3
        "index":  3,  # LED4
        "thumb":  4   # LED5
    }.get(finger, None)


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
    try:
        data = ujson.loads(msg)
        for finger, info in data.items():
            pressed = info.get("pressed", False)
            color = info.get("color", "#000000")
            freq = info.get("freq", 0)
            led_index = finger_to_led_index(finger)
            r,g,b = hex_to_bin_rgb(color)

            if not isinstance(freq,int):
                freq = 0

            if led_index is not None and 0 <= led_index < len(leds):
                if pressed:
                    set_led_color(leds[led_index], r,g,b)
                    motors[led_index].duty_u16(freq)
                else:
                    turn_off_led(leds[led_index])
                    motors[led_index].duty_u16(0)
    except Exception as e:
        print("Error en on_mqtt_message:", e)

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
    """Patrón de inicio - testea LEDs y motores secuencialmente y en grupo"""
    print("Iniciando patrón de LEDs y motores...")
    for i, led in enumerate(leds):
        time.sleep(1.0)
        # Rojo, verde, azul secuencial
        set_led_color(led, 1,0,0); motors[i].duty_u16(10000); time.sleep(0.2)
        set_led_color(led, 0,1,0); motors[i].duty_u16(20000); time.sleep(0.2)
        set_led_color(led, 0,0,1); motors[i].duty_u16(30000); time.sleep(0.2)
        turn_off_led(led); motors[i].duty_u16(0); time.sleep(0.2)
    # Todos juntos
    for _ in range(3):
        for led in leds: set_led_color(led,1,1,1)
        for motor in motors: motor.duty_u16(40000)
        time.sleep(0.3)
        for led in leds: turn_off_led(led)
        for motor in motors: motor.duty_u16(0)
        time.sleep(0.3)
    print("Patrón completado")


# ================================
# MAIN
# ================================
def main():

   # --- Inicialización --- 
    print("=== INICIANDO HAPTIC GLOVE ===")
    init_motors()
    startup_pattern()

    wifi_ap_mode()
    client = mqtt_connect()

    last_pressed = [False]*5
    LOOP_DT, PUB_MS = 0.02, 100
    t_pub = time.ticks_ms()

    if client:
        client.set_callback(on_mqtt_message)

    print("[MAIN] Sistema en ejecución.")

    # --- Bucle principal ---
    while True:
        
        pressed = read_sensors()
        if time.ticks_diff(time.ticks_ms(), t_pub) >= PUB_MS:
            last_pressed = publish_states_if_changed(client, pressed, last_pressed)
            t_pub = time.ticks_ms()

   
        if client:
            try:
                client.check_msg()
            except Exception as e:
                print("[MQTT] check_msg error:", e)
                client = mqtt_connect()  # reintento si falla

        time.sleep(LOOP_DT)
# ================================================================
# ENTRY POINT
# ================================================================

if __name__ == "__main__":
    main()