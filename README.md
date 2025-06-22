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
* **Puerto TLS:** 8883
* **Topic usado:** picow/fingers
* **Seguridad:** autenticación con usuario y contraseña



