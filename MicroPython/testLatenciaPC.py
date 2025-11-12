#!/usr/bin/env python3
"""
Test de latencia WiFi pura (sin MQTT)
Ejecutar en PC después de conectarse al AP del Pico
"""

import socket
import time
import statistics

def test_wifi_latency(num_packets=100):
    """
    Envía paquetes UDP al Pico y mide latencia de ida y vuelta
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(2.0)  # 2 segundos timeout
    
    pico_ip = '192.168.4.1'
    port = 5555
    
    print(f"╔════════════════════════════════════════╗")
    print(f"║   TEST DE LATENCIA WiFi PURA           ║")
    print(f"╠════════════════════════════════════════╣")
    print(f"║ Pico IP: {pico_ip}")
    print(f"║ Puerto:  {port}")
    print(f"║ Paquetes: {num_packets}")
    print(f"╚════════════════════════════════════════╝\n")
    
    latencies = []
    timeouts = 0
    
    print("Enviando paquetes...\n")
    
    for i in range(num_packets):
        msg = f"test_{i}".encode()
        
        try:
            # Enviar y medir
            start = time.perf_counter()
            sock.sendto(msg, (pico_ip, port))
            
            # Esperar respuesta
            data, addr = sock.recvfrom(1024)
            end = time.perf_counter()
            
            # Calcular latencia en ms
            latency_ms = (end - start) * 1000
            latencies.append(latency_ms)
            
            # Mostrar progreso cada 10 paquetes
            if (i + 1) % 10 == 0:
                print(f"[{i+1:3d}/{num_packets}] Última: {latency_ms:6.2f}ms | "
                      f"Promedio actual: {sum(latencies)/len(latencies):6.2f}ms")
            
        except socket.timeout:
            timeouts += 1
            print(f"[{i+1:3d}/{num_packets}] TIMEOUT")
        
        except Exception as e:
            print(f"[{i+1:3d}/{num_packets}] ERROR: {e}")
        
        # Pequeña pausa entre paquetes
        time.sleep(0.05)
    
    sock.close()
    
    # Calcular estadísticas
    if latencies:
        avg = statistics.mean(latencies)
        median = statistics.median(latencies)
        stdev = statistics.stdev(latencies) if len(latencies) > 1 else 0
        min_lat = min(latencies)
        max_lat = max(latencies)
        
        print(f"\n╔════════════════════════════════════════╗")
        print(f"║           RESULTADOS FINALES           ║")
        print(f"╠════════════════════════════════════════╣")
        print(f"║ Paquetes exitosos: {len(latencies)}/{num_packets}")
        print(f"║ Timeouts:          {timeouts}")
        print(f"║ Tasa éxito:        {len(latencies)/num_packets*100:.1f}%")
        print(f"║")
        print(f"║ Latencia mínima:   {min_lat:6.2f} ms")
        print(f"║ Latencia máxima:   {max_lat:6.2f} ms")
        print(f"║ Latencia promedio: {avg:6.2f} ms")
        print(f"║ Mediana:           {median:6.2f} ms")
        print(f"║ Desv. estándar:    {stdev:6.2f} ms")
        print(f"╚════════════════════════════════════════╝\n")
        
        # Distribución por rangos
        print("Distribución de latencias:")
        ranges = [
            (0, 50, "0-50ms   (EXCELENTE)"),
            (50, 100, "50-100ms (BUENO)"),
            (100, 200, "100-200ms (ACEPTABLE)"),
            (200, 500, "200-500ms (PROBLEMÁTICO)"),
            (500, float('inf'), ">500ms   (CRÍTICO)")
        ]
        
        for min_r, max_r, label in ranges:
            count = sum(1 for lat in latencies if min_r <= lat < max_r)
            pct = count / len(latencies) * 100
            bar = "█" * int(pct / 2)
            print(f"{label}: {bar} {count} ({pct:.1f}%)")
        
        # Interpretación
        print(f"\n{'='*50}")
        print("INTERPRETACIÓN:")
        if avg < 50:
            print("✅ Excelente - WiFi funcionando óptimamente")
        elif avg < 100:
            print("✅ Bueno - Latencia aceptable para tiempo real")
        elif avg < 200:
            print("⚠️  Aceptable - Pero mejorable")
        elif avg < 300:
            print("❌ Problemático - Latencia alta, limitación de hardware")
        else:
            print("🔴 Crítico - WiFi muy lento, problema serio")
        
        print(f"\nSi esta latencia es >200ms, cambiar el broker MQTT")
        print(f"NO mejorará el rendimiento. El problema es el WiFi.")
        print(f"{'='*50}\n")
        
    else:
        print("\n❌ No se recibieron respuestas. Verifica:")
        print("  1. PC conectado a 'HapticGlove'")
        print("  2. Pico ejecutando test_wifi.py")
        print("  3. Firewall del PC desactivado")

if __name__ == "__main__":
    print("\nAsegúrate de estar conectado al AP 'HapticGlove' antes de continuar.")
    input("Presiona ENTER para comenzar el test...")
    
    test_wifi_latency(num_packets=100)
    
    print("\nTest completado. Presiona ENTER para salir...")
    input()