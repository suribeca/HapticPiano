import gc
gc.collect()
print("Memoria libre antes de conectar MQTT:", gc.mem_free())

from machine import ADC, Pin, PWM
import network
import time
import ujson
from umqtt.simple import MQTTClient
import usocket as socket

# ==== Conexiones WiFi y MQTT ====
SSID = 'id' # id de la red de internet
PASSWORD = 'pswd' # contraseña de la red
SERVER_HOSTNAME = 'dae3db229f2d427b820bf6346fece546.s1.eu.hivemq.cloud'
MQTT_USER = 'PianoBroker'
MQTT_PASS = 'PapaPitufo420'
TOPIC = b'picow/fingers'

# ==== Pines de sensores analógicos y digitales ====
FSR_PINS = {
    "LED1": ADC(Pin(28)),
    "LED2": ADC(Pin(27)),
    "LED3": ADC(Pin(26)),
}
FSR_DIGITAL_1 = Pin(22, Pin.IN, Pin.PULL_DOWN)
FSR_DIGITAL_2 = Pin(21, Pin.IN, Pin.PULL_DOWN)

# ==== LEDs RGB ====
leds = {
    "LED1": [PWM(Pin(13)), PWM(Pin(14)), PWM(Pin(15))],
    "LED2": [PWM(Pin(10)), PWM(Pin(11)), PWM(Pin(12))],
    "LED3": [PWM(Pin(7)),  PWM(Pin(8)),  PWM(Pin(9))],
    "LED4": [PWM(Pin(4)),  PWM(Pin(5)),  PWM(Pin(6))],
    "LED5": [PWM(Pin(1)),  PWM(Pin(2)),  PWM(Pin(3))]
}

# ==== Motores ====
motores = {
    "LED1": Pin(16, Pin.OUT),
    "LED2": Pin(17, Pin.OUT),
    "LED3": Pin(18, Pin.OUT),
    "LED4": Pin(19, Pin.OUT),
    "LED5": Pin(20, Pin.OUT)
}

# Configurar LEDs
for led in leds.values():
    for pwm in led:
        pwm.freq(1000)

COLOR_WHEEL = [
    (65535, 0, 0), (65535, 32768, 0), (65535, 65535, 0),
    (32768, 65535, 0), (0, 65535, 0), (0, 65535, 65535),
    (0, 0, 65535), (32768, 0, 65535), (65535, 0, 65535)
]

def set_led_color(led, color):
    r, g, b = color
    led[0].duty_u16(r)
    led[1].duty_u16(g)
    led[2].duty_u16(b)

def turn_off_led(led):
    set_led_color(led, (0, 0, 0))

def wheel_animation_step(led, step):
    set_led_color(led, COLOR_WHEEL[step])

# ==== Mapeo para detección ====
sensor_map = {
    "LED1": lambda: FSR_PINS["LED1"].read_u16() >= 52428,
    "LED2": lambda: FSR_PINS["LED2"].read_u16() >= 52428,
    "LED3": lambda: FSR_PINS["LED3"].read_u16() >= 52428,
    "LED4": lambda: FSR_DIGITAL_1.value() == 1,
    "LED5": lambda: FSR_DIGITAL_2.value() == 1,
}

# Estado de animaciones
color_step = {key: 0 for key in leds}
estado_anterior = {key: False for key in leds}

# ==== Conexión Wi-Fi ====
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print('Conectando a WiFi...')
        wlan.connect(SSID, PASSWORD)
        while not wlan.isconnected():
            time.sleep(1)
    print('✅ WiFi conectado:', wlan.ifconfig())

# ==== Conexión MQTT ====
def connect_mqtt():
    client = MQTTClient(
        client_id=b'PicoClient',
        server=SERVER_HOSTNAME,
        port=0,
        user=MQTT_USER,
        password=MQTT_PASS,
        keepalive=7200,
        ssl=True,
        ssl_params={'server_hostname': SERVER_HOSTNAME}
    )
    client.connect()
    print("✅ MQTT conectado")
    return client

# ==== Publicación de estados ====
def get_estado_colores():
    colors = {}
    for led_name in leds:
        activo = sensor_map[led_name]()
        if activo:
            colors[get_dedo(led_name)] = "#00ff00"
        else:
            colors[get_dedo(led_name)] = "#cccccc"
    return colors

def get_dedo(led_name):
    # Mapea LED1 → thumb, etc.
    mapping = {
        "LED1": "thumb",
        "LED2": "index",
        "LED3": "middle",
        "LED4": "ring",
        "LED5": "pinky"
    }
    return mapping[led_name]

def publicar_estado(client):
    payload = ujson.dumps(get_estado_colores())
    client.publish(TOPIC, payload)
    print("Publicado:", payload)

# ==== Main ====
connect_wifi()
client = connect_mqtt()

while True:
    for led_name in leds:
        led = leds[led_name]
        motor = motores[led_name]
        activo = sensor_map[led_name]()

        if activo:
            wheel_animation_step(led, color_step[led_name])
            color_step[led_name] = (color_step[led_name] + 1) % len(COLOR_WHEEL)
            motor.value(1)
        else:
            turn_off_led(led)
            motor.value(0)

    publicar_estado(client)
    time.sleep(0.3)

