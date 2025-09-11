# ===== Pico W + Mosquitto (Access Point Mode) =====
# - Local-first: sensores controlan LED (VERDE) y motor sin latencia.
# - Publica cambios de estado a 'picow/fingers' (Pico -> Web).
# - Suscribe 'web/pressed' pero IGNORA color/freq por ahora (puente listo).
# - Histeresis analógica + debounce digital para evitar falsos (meñique, etc.).
# - Mapeo de motores probado: motor_mapping = [3, 4, 1, 0, 2]

import time, ujson, network
from machine import ADC, Pin, PWM
from umqtt.simple import MQTTClient

# ----------- WiFi Access Point / MQTT -----------
AP_SSID = "HapticGlove"
AP_PASSWORD = "12345678"
AP_IP = "192.168.4.1"
BROKER_IP = '192.168.4.17'  # IP de tu PC cuando se conecte al AP
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
def on_mqtt_message(topic, msg):
    # Estructura esperada (si algún día quieres reactivar):
    # {"thumb":{"pressed":true,"color":"#00ff00","freq":50000}, ...}
    # Por ahora, lo ignoramos a propósito para que nada meta latencia.
    try:
        print("MQTT recibido:", topic.decode(), msg.decode())
    except:
        pass

def wifi_ap_mode():
    """Configura el Pico W como Access Point"""
    print("Configurando Access Point...")
    
    # Desactivar modo cliente
    wlan_sta = network.WLAN(network.STA_IF)
    wlan_sta.active(False)
    time.sleep(1)
    
    # Configurar Access Point
    ap = network.WLAN(network.AP_IF)
    ap.active(False)
    time.sleep(1)
    
    ap.active(True)
    time.sleep(2)
    
    # Configuración del AP (modo compatible)
    try:
        # Intentar con diferentes modos de autenticación disponibles
        if hasattr(network, 'AUTH_WPA_WPA2_PSK'):
            authmode = network.AUTH_WPA_WPA2_PSK
        elif hasattr(network, 'AUTH_WPA2_PSK'):
            authmode = network.AUTH_WPA2_PSK
        elif hasattr(network, 'AUTH_WPA_PSK'):
            authmode = network.AUTH_WPA_PSK
        else:
            authmode = 3  # Valor típico para WPA2-PSK
        
        ap.config(
            essid=AP_SSID,
            password=AP_PASSWORD,
            authmode=authmode,
            channel=6
        )
        print(f"AP configurado con authmode: {authmode}")
        
    except Exception as e:
        print(f"Error en configuración avanzada: {e}")
        # Configuración básica como fallback
        ap.config(essid=AP_SSID, password=AP_PASSWORD)
        print("Usando configuración básica")
    
    # Configurar IP
    ap.ifconfig((AP_IP, '255.255.255.0', AP_IP, '8.8.8.8'))
    
    # Verificar que esté activo
    timeout = 10
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
            print(f"MQTT conectado exitosamente!")
            return c
        except Exception as e:
            print(f"Error MQTT: {e}")
            if attempt < max_attempts - 1:
                print("Esperando 3 segundos antes de reintentar...")
                time.sleep(3)
    
    print("⚠ MQTT no disponible, funcionando solo en modo local")
    return None

# Publicar sólo si cambió el estado (menos tráfico)
last_pressed = [False]*5
def publish_states_if_changed(client, pressed):
    global last_pressed
    if not client:  # Si no hay conexión MQTT, no publicar
        return
        
    if pressed != last_pressed:
        payload = {
            # mismo mapeo "LED1..LED5 ↔ pinky, ring, middle, index, thumb"
            "pinky":  bool(pressed[0]),
            "ring":   bool(pressed[1]),
            "middle": bool(pressed[2]),
            "index":  bool(pressed[3]),
            "thumb":  bool(pressed[4]),
            "timestamp": time.ticks_ms()
        }
        try:
            client.publish(TOPIC_ESTADO, ujson.dumps(payload))
            print("Estado:", [i for i, p in enumerate(pressed) if p])  # Solo mostrar dedos presionados
        except Exception as e:
            # Si falla la publicación, seguimos con lazo local
            print("MQTT publish error:", e)
        last_pressed = pressed[:]

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

# ----------- Main -----------
print("=== INICIANDO HAPTIC GLOVE ===")

# Patrón de inicio para verificar hardware
startup_pattern()

# Configurar Access Point
try:
    ap = wifi_ap_mode()
except Exception as e:
    print(f"ERROR configurando AP: {e}")
    print("Revisa el hardware del Pico W")
    raise

# Esperar a que el usuario conecte su PC
print("\nEsperando conexión de PC...")
print("1. Conecta tu PC a la red 'HapticGlove'")
print("2. Inicia Mosquitto en tu PC")
print("3. El Pico intentará conectarse al broker MQTT")

# Dar tiempo para la conexión
for i in range(10, 0, -1):
    print(f"Iniciando en {i}s...")
    time.sleep(1)

# Intentar conectar MQTT (opcional)
client = mqtt_connect()

# Variables del loop principal
LOOP_DT = 0.02  # 20 ms: respuesta rápida pero estable
PUB_MS  = 100   # publicar máx 10 Hz
t_pub   = time.ticks_ms()

print("\n=== SISTEMA ACTIVO ===")
print("Sensores → LEDs verdes + Motores")
if client:
    print("MQTT → Publicando a 'picow/fingers'")
print("========================")

while True:
    # Procesa tráfico MQTT entrante sin bloquear
    if client:
        try:
            client.check_msg()
        except Exception as e:
            print("MQTT check_msg error:", e)
            # Intento de reconexión
            client = mqtt_connect()

    # Lectura de sensores (con filtros) y aping 192.168.4.1ccionamiento local inmediato
    pressed = read_pressed_list()

    # Control local inmediato (sin latencia)
    for i in range(5):
        motor_idx = motor_mapping[i]
        if pressed[i]:
            set_led_green(leds[i])
            motors[motor_idx].value(1)
        else:
            turn_off_led(leds[i])
            motors[motor_idx].value(0)

    # Telemetría periódica si cambió algo
    if time.ticks_diff(time.ticks_ms(), t_pub) >= PUB_MS:
        publish_states_if_changed(client, pressed)
        t_pub = time.ticks_ms()

    time.sleep(LOOP_DT)