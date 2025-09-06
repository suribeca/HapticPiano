# HapticPiano

npm install
npm run para correr.

Piano funciona correctamente en chrome.
En edge funciona pero no se iluminan las notas

Versión del firmware funcional: **v1.22.1 (2024-01-05).uf2** [link text](descargado de https://micropython.org/download/RPI_PICO_W/)

Este proyecto implementa un sistema de retroalimentación háptica y visual para la enseñanza del piano, diseñado especialmente para adolescentes con discapacidad auditiva. Utiliza una Raspberry Pi Pico W, sensores de presión (FSR), motores vibradores, LEDs RGB y comunicación MQTT para sincronizar la interacción física con una interfaz visual en React.

## Funcionalidad (21/06/25)
Cada vez que el usuario presiona un sensor:
  1. Se ilumina el LED correspondiente con una animación.
  2. Vibra el motor asociado a ese dedo.
  3. Se envía un mensaje JSON al servidor MQTT con el estado de los dedos.
  4. El frontend en React actualiza en tiempo real los colores de la mano en pantalla.

## Comunicación MQTT
* **Broker:** HiveMQ Cloud
* **Puerto TLS:** 8884 y 0
* **Topic usado:** picow/fingers
* **Seguridad:** autenticación con usuario y contraseña

## Configuración Mosquitto
1. Instalación de la versión x64 fuera de Program Files, de preferencia directo en C
2. Crear C:\mosquitto\log y C:\mosquitto\data
3. Crear C:\mosquitto\mosquitto.conf
4. Habilitar el firewall Puerto → TCP → 1883, 9001 → Permitir → Redes privadas → Nombre “Mosquitto MQTT/WS”.

## Arranque y prueba de Mosquitto (siempre desde dond esté el Mosquitto)
1. En una cmd correr mosquitto.exe -v -c mosquitto.conf
2. Subscripción: mosquitto_sub -h localhost -t test_sensor_data -v
3. Publicación: mosquitto_pub -h localhost -t test_sensor_data -m "Hello Test 1"
4. En vscode checar el .env y poner IPv4
5. En Thonny checar y poner IPv4 + wifi
6. Correr y ser feli




