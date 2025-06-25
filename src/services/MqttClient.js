// Importa la librería MQTT.js para conectarte a un broker MQTT desde el navegador
import mqtt from 'mqtt';

// Variable para almacenar la instancia del cliente MQTT
let client = null;

/**
 * Función para conectar al broker MQTT.
 * @param {function} onMessageCallback - Función que se ejecutará cada vez que se reciba un mensaje del topic suscrito.
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
  client = mqtt.connect('wss://dc882ec947774d7997f7af426c65bd0e.s1.eu.hivemq.cloud:8884/mqtt', options);

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