import gc
import ujson
import time
import network
from machine import ADC, Pin, PWM
from umqtt.simple import MQTTClient

gc.collect()

# === Conexión WiFi ===
SSID = 'ITAM'
PASSWORD = ''

# === Configuración del broker MQTT ===
SERVER_HOSTNAME = 'dae3db229f2d427b820bf6346fece546.s1.eu.hivemq.cloud'
MQTT_USER = 'PianoBroker'
MQTT_PASS = 'PapaPitufo420'
TOPIC_ESTADO = 'picow/fingers'
TOPIC_FEEDBACK = 'web/pressed'

# === Pines de sensores analógicos y digitales ===
FSR_PINS = {
    "LED1": ADC(Pin(28)),
    "LED2": ADC(Pin(27)),
    "LED3": ADC(Pin(26)),
}
FSR_DIGITAL_1 = Pin(22, Pin.IN, Pin.PULL_DOWN)
FSR_DIGITAL_2 = Pin(21, Pin.IN, Pin.PULL_DOWN)

# === LEDs RGB ===
leds = {
    "LED1": [PWM(Pin(1)),  PWM(Pin(2)),  PWM(Pin(3))],
    "LED2": [PWM(Pin(4)),  PWM(Pin(5)),  PWM(Pin(6))],
    "LED3": [PWM(Pin(7)),  PWM(Pin(8)),  PWM(Pin(9))],
    "LED4": [PWM(Pin(10)), PWM(Pin(11)), PWM(Pin(12))],
    "LED5": [PWM(Pin(13)), PWM(Pin(14)), PWM(Pin(15))]
}

# === Motores ===
motores = {
    "LED1": PWM(Pin(19)),
    "LED2": PWM(Pin(20)),
    "LED3": PWM(Pin(17)),
    "LED4": PWM(Pin(16)),
    "LED5": PWM(Pin(18))
}

# === Configurar PWM ===
for led in leds.values():
    for pwm in led:
        pwm.freq(1000)
for motor in motores.values():
    motor.freq(1000)

# === Mapeo de sensores ===
sensor = {
    "LED1": lambda: FSR_PINS["LED1"].read_u16() >= 18000,
    "LED2": lambda: FSR_PINS["LED2"].read_u16() >= 18000,
    "LED3": lambda: FSR_PINS["LED3"].read_u16() >= 18000,
    "LED4": lambda: FSR_DIGITAL_1.value() == 1,
    "LED5": lambda: FSR_DIGITAL_2.value() == 1,
}

# === Utilidades ===
def set_led_color(led, r, g, b):
    led[0].duty_u16(r)
    led[1].duty_u16(g)
    led[2].duty_u16(b)

def turn_off_led(led):
    set_led_color(led, 0, 0, 0)

def hex_to_rgb565(hex_color):
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) * 257
    g = int(hex_color[2:4], 16) * 257
    b = int(hex_color[4:6], 16) * 257
    return (r, g, b)

def get_dedo(led_name):
    return {
        "LED5": "thumb",
        "LED4": "index",
        "LED3": "middle",
        "LED2": "ring",
        "LED1": "pinky"
    }[led_name]

def dedo_a_led(finger):
    return {
        "thumb": "LED5",
        "index": "LED4",
        "middle": "LED3",
        "ring": "LED2",
        "pinky": "LED1"
    }.get(finger, None)

def get_estado_presionado():
    estado = {}
    for led_name in leds:
        estado[get_dedo(led_name)] = sensor[led_name]()
    return estado

def publicar_estado(client):
    estado = get_estado_presionado()
    payload = ujson.dumps(estado)
    client.publish(TOPIC_ESTADO, payload)

# === CORREGIDO: Callback al recibir mensaje MQTT ===
def on_mqtt_message(topic, msg):
    print("Mensaje recibido por MQTT:", msg)
    try:
        data = ujson.loads(msg)
        for finger, info in data.items():
            pressed = info.get("pressed", False)
            color = info.get("color", "#000000")
            freq = info.get("freq", 0)

            if not isinstance(freq, int):
                freq = 0

            led_name = dedo_a_led(finger)
            if led_name and led_name in leds:
                r, g, b = hex_to_rgb565(color)
                if pressed:
                    set_led_color(leds[led_name], r, g, b)
                    motores[led_name].duty_u16(freq)
                else:
                    turn_off_led(leds[led_name])
                    motores[led_name].duty_u16(0)

    except Exception as e:
        print("Error al manejar mensaje MQTT:", e)

# === Conexión WiFi y MQTT ===
def connect_wifi():
    wlan = network.WLAN(network.STA_IF)
    wlan.active(True)
    if not wlan.isconnected():
        print('Conectando a WiFi...')
        wlan.connect(SSID, PASSWORD)
        while not wlan.isconnected():
            time.sleep(1)
    print('✅ WiFi conectado:', wlan.ifconfig())

def connect_mqtt():
    client = MQTTClient(
        client_id=b'PicoClient',
        server=SERVER_HOSTNAME,
        port=8883,
        user=MQTT_USER,
        password=MQTT_PASS,
        keepalive=7200,
        ssl=True,
        ssl_params={'server_hostname': SERVER_HOSTNAME}
    )
    client.set_callback(on_mqtt_message)
    client.connect()
    client.subscribe(TOPIC_FEEDBACK)
    print("✅ MQTT conectado")
    return client

# === Main loop ===
connect_wifi()
client = connect_mqtt()

while True:
    client.check_msg()
    time.sleep(0.2)
    publicar_estado(client)
    time.sleep(0.1)
