from machine import ADC, Pin, PWM
import time

# -------------------
# Sensores
# -------------------
sensors = [
    ADC(Pin(28)),  # Sensor 1 (analógico)
    ADC(Pin(27)),  # Sensor 2
    ADC(Pin(26)),  # Sensor 3
    Pin(22, Pin.IN, Pin.PULL_DOWN),  # Sensor 4 (digital)
    Pin(21, Pin.IN, Pin.PULL_DOWN)   # Sensor 5 (digital)
]

# -------------------
# LEDs RGB (DIGITALES)
# -------------------
leds = [
    [Pin(1, Pin.OUT),  Pin(2, Pin.OUT),  Pin(3, Pin.OUT)],    # LED 1: Pinky
    [Pin(4, Pin.OUT),  Pin(5, Pin.OUT),  Pin(6, Pin.OUT)],    # LED 2: Ring
    [Pin(7, Pin.OUT),  Pin(8, Pin.OUT),  Pin(9, Pin.OUT)],    # LED 3: Middle
    [Pin(10, Pin.OUT), Pin(11, Pin.OUT), Pin(12, Pin.OUT)],   # LED 4: Index
    [Pin(13, Pin.OUT), Pin(14, Pin.OUT), Pin(15, Pin.OUT)]    # LED 5: Thumb
]

# -------------------
# Motores PWM
# -------------------
motors = [
    PWM(Pin(16)),  # Motor 1
    PWM(Pin(17)),  # Motor 2
    PWM(Pin(18)),  # Motor 3
    PWM(Pin(19)),  # Motor 4
    PWM(Pin(20))   # Motor 5
]

# Mapear sensor → motor
motor_mapping = [3, 4, 1, 0, 2]

# Configurar frecuencia PWM para motores
for m in motors:
    m.freq(1000)

# -------------------
# Colores fijos por dedo
# -------------------
finger_colors = [
    (1, 0, 0),   # Pinky: rojo
    (0, 1, 0),   # Ring: verde
    (0, 0, 1),   # Middle: azul
    (1, 1, 0),   # Index: amarillo
    (1, 0, 1)    # Thumb: magenta
]

# -------------------
# Funciones de LED
# -------------------
def set_led_color(led, r, g, b):
    led[0].value(1 if r else 0)
    led[1].value(1 if g else 0)
    led[2].value(1 if b else 0)

def turn_off_led(led):
    led[0].value(0)
    led[1].value(0)
    led[2].value(0)

# -------------------
# Loop principal
# -------------------
while True:
    for i in range(5):
        # Lectura de sensores
        if i < 3:
            active = sensors[i].read_u16() > 30000
        else:
            active = sensors[i].value() == 1

        motor_index = motor_mapping[i]

        if active:
            r, g, b = finger_colors[i]
            set_led_color(leds[i], r, g, b)
            motors[motor_index].duty_u16(40000) 
        else:
            turn_off_led(leds[i])
            motors[motor_index].duty_u16(0)

    time.sleep(0.05)
