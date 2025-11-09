# Prueba simple para verificar que el Pico W puede crear un AP
import network
import time

print("=== PRUEBA SIMPLE DE ACCESS POINT ===")

# Desactivar todo primero
sta = network.WLAN(network.STA_IF)
sta.active(False)
time.sleep(1)

ap = network.WLAN(network.AP_IF)
ap.active(False)
time.sleep(2)

print("Activando Access Point...")
ap.active(True)
time.sleep(3)

# Configurar red simple
ap.config(essid="TestPicoW", password="12345678")
time.sleep(2)

print(f"AP Activo: {ap.active()}")
if ap.active():
    print(f"Configuración: {ap.ifconfig()}")
    print("¡Busca la red 'TestPicoW' en tu PC!")
else:
    print("ERROR: No se pudo activar el AP")

# Mantener activo y mostrar status cada 5 segundos
while True:
    print(f"\nStatus AP: Activo={ap.active()}, Status={ap.status()}")
    if ap.active():
        print(f"Config: {ap.ifconfig()}")
    else:
        print("Reactivando AP...")
        ap.active(True)
        time.sleep(2)
    time.sleep(5)
