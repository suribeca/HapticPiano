// Importa la librería MQTT.js para conectarte a un broker MQTT desde el navegador
import mqtt from 'mqtt';

// Variable para almacenar la instancia del cliente MQTT
let client = null;

/**
 * Función para conectar al broker MQTT usando WebSockets seguros.
 * Se utiliza HiveMQ Cloud como servidor.
 * 
 * Además esta función se suscribe al tópico 'picow/fingers' que recibe los datos del Raspberry Pi Pico W 
 * 
 * @param {function} onMessageCallback - Función callback que se ejecuta cuando se recibe un mensaje MQTT válido.
 * El mensaje se entrega como objeto JavaScript (ya parseado desde JSON).
 */
export function connectMQTT(onMessageCallback) {
  // Si ya hay una conexión activa, no vuelve a conectar
  if (client) return;

  // Opciones de configuración para la conexión segura con HiveMQ Cloud
  const options = {
    username: 'PianoBroker',            // Usuario del broker
    password: 'PapaPitufo420',          // Contraseña del broker
    protocol: 'wss',                    // Usamos WebSockets seguros
    port: 8884,                         // Puerto para WSS
    connectTimeout: 4000,               // Tiempo máximo para intentar conexión (ms)
    clean: true,                        // Sesión limpia (no guarda historial previo)
    reconnectPeriod: 1000,              // Reintenta conexión cada 1 segundo si se pierde
  };

  // Conecta al broker especificando la URL completa del endpoint WSS + opciones
  client = mqtt.connect('wss://dae3db229f2d427b820bf6346fece546.s1.eu.hivemq.cloud:8884/mqtt', options);

  // Cuando se establece la conexión exitosamente
  client.on('connect', () => {
    console.log('Conectado a MQTT');

    // Se suscribe al topic desde donde la Raspberry publicará los datos de los dedos
    client.subscribe('picow/fingers', (err) => {
      if (err) {
        console.error('Error al suscribirse:', err);
      }
    });
  });

  // Cuando se recibe un mensaje desde el broker en un topic suscrito
  client.on('message', (topic, message) => {
    try {
      // Intenta convertir el mensaje de texto a objeto JSON
      const data = JSON.parse(message.toString());

      // Llama al callback proporcionado para que el resto del sistema lo use
      if (onMessageCallback) {
        onMessageCallback(data);
      }
    } catch (error) {
      console.error('Error al parsear mensaje:', error);
    }
  });

  // Si ocurre un error con la conexión al broker
  client.on('error', (err) => {
    console.error('Error en MQTT:', err);
  });
}

/**
 * Publica el estado completo de todos los dedos al broker.
 * @param {Object} fingerStates - Objeto con el estado de cada dedo (pressed + color)
 */
export function publishFeedback(fingerStates) {
  if (!client || !client.connected) {
    console.warn('Cliente MQTT no conectado');
    return;
  }
  const payload = JSON.stringify(fingerStates);

  client.publish('web/pressed', payload, { qos: 0 }, (err) => {
    if (err) {
      console.error('Error al publicar estado completo:', err);
    } else {
      console.log(`Publicado estado completo: ${payload}`);
    }
  });
}