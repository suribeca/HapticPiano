
# Test de latencia WiFi pura (sin MQTT)
# Mide cuánto tarda un mensaje en viajar PC → Pico → PC

import socket
import time
import network

# WiFi AP
AP_SSID, AP_PASSWORD, AP_IP = "HapticGlove", "12345678", "192.168.4.1"

def wifi_setup():
    network.WLAN(network.STA_IF).active(False)
    ap = network.WLAN(network.AP_IF)
    ap.config(essid=AP_SSID, password=AP_PASSWORD)
    ap.ifconfig((AP_IP, "255.255.255.0", AP_IP, "8.8.8.8"))
    ap.active(True)
    time.sleep(1)
    print(f"[WIFI] AP activo: {ap.ifconfig()[0]}")
    return ap

def udp_echo_server():
    """Servidor UDP que hace eco de mensajes"""
    wifi_setup()
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(('0.0.0.0', 5555))
    sock.settimeout(0.01)  # Non-blocking
    
    print("[UDP] Servidor escuchando en puerto 5555")
    print("[UDP] Envía mensajes UDP desde PC y mide latencia")
    
    count = 0
    while True:
        try:
            data, addr = sock.recvfrom(1024)
            # Echo inmediato
            sock.sendto(data, addr)
            count += 1
            if count % 100 == 0:
                print(f"[UDP] {count} paquetes procesados")
        except OSError:
            pass
        time.sleep(0.001)

if __name__ == "__main__":
    udp_echo_server()