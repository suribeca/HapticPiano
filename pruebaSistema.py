from machine import ADC, Pin, PWM
import time

# Sensores
sensors = [
    ADC(Pin(28)),  # Sensor 1 (analógico)
    ADC(Pin(27)),  # Sensor 2
    ADC(Pin(26)),  # Sensor 3
    Pin(22, Pin.IN, Pin.PULL_DOWN),  # Sensor 4 (digital)
    Pin(21, Pin.IN, Pin.PULL_DOWN)   # Sensor 5 (digital)
]

# LEDs RGB
leds = [
    [PWM(Pin(1)),  PWM(Pin(2)),  PWM(Pin(3))],    # LED 1
    [PWM(Pin(4)),  PWM(Pin(5)),  PWM(Pin(6))],    # LED 2
    [PWM(Pin(7)),  PWM(Pin(8)),  PWM(Pin(9))],    # LED 3
    [PWM(Pin(10)), PWM(Pin(11)), PWM(Pin(12))],   # LED 4
    [PWM(Pin(13)), PWM(Pin(14)), PWM(Pin(15))]    # LED 5
]

# Motores conectados a GPIO 16–20 (orden físico)
motors = [
    Pin(16, Pin.OUT),  # Motor 1
    Pin(17, Pin.OUT),  # Motor 2
    Pin(18, Pin.OUT),  # Motor 3
    Pin(19, Pin.OUT),  # Motor 4
    Pin(20, Pin.OUT)   # Motor 5
]

# Mapeo lógico de motores según conexión física del guante
# Posición i del sensor → índice del motor
motor_mapping = [3, 4, 1, 0, 2]

# Configurar frecuencia PWM para LEDs
for led in leds:
    for color in led:
        color.freq(1000)

# Colores: rojo → verde → azul
colors = [
    (65535, 0, 0),   # Rojo
    (0, 65535, 0),   # Verde
    (0, 0, 65535)    # Azul
]

def set_led_color(led, r, g, b):
    led[0].duty_u16(r)
    led[1].duty_u16(g)
    led[2].duty_u16(b)

def turn_off_led(led):
    set_led_color(led, 0, 0, 0)

# Loop principal
color_index = 0

while True:
    for i in range(5):
        if i < 3:
            active = sensors[i].read_u16() > 30000
        else:
            active = sensors[i].value() == 1

        motor_index = motor_mapping[i]

        if active:
            # LEDs animados
            r, g, b = colors[color_index]
            set_led_color(leds[i], r, g, b)

            # Motor correspondiente
            motors[motor_index].value(1)
        else:
            turn_off_led(leds[i])
            motors[motor_index].value(0)

    color_index = (color_index + 1) % len(colors)
    time.sleep(0.1)
