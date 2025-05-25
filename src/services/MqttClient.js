import mqtt from 'mqtt'; // Importa la librería MQTT para conectar con el broker vía WebSockets

// Variable global que guarda la instancia del cliente MQTT
let client = null;

/**
 * Función que establece la conexión al broker MQTT y escucha mensajes del topic 'picow/fingers'.
 * @param {Function} onMessageCallback - Función que se ejecuta cuando se recibe un mensaje.
 */

export function connectMQTT(onMessageCallback) {
  // Evita múltiples conexiones si ya existe una activa
  if (client) return;

  // Configuración de conexión al broker MQTT (HiveMQ en la nube)
  const options = {
    username: 'PianoBroker',      // Usuario configurado en HiveMQ Cloud
    password: 'PapaPitufo420',    // Contraseña correspondiente
    protocol: 'wss',              // Usamos WebSocket Secure (para navegador)
    port: 8884,                   // Puerto de conexión para WSS en HiveMQ
    connectTimeout: 4000,         // Tiempo máximo para intentar conexión (4 segundos)
    clean: true,                  // Inicia una sesión nueva (sin guardar estado anterior)
    reconnectPeriod: 1000,        // Si se pierde la conexión, reintenta cada 1 segundo
  };

  // Conecta al broker MQTT utilizando la URL y opciones definidas
  client = mqtt.connect('wss://dae3db229f2d427b820bf6346fece546.s1.eu.hivemq.cloud:8884/mqtt', options);

  // Evento que se ejecuta al conectarse exitosamente
  client.on('connect', () => {
    console.log('Conectado a MQTT');

    // Se suscribe al topic que manda la Pico con los datos de los dedos
    client.subscribe('picow/fingers', (err) => {
      if (err) console.error('Error al suscribirse:', err);
    });
  });

  // Evento que se ejecuta cuando se recibe un mensaje en cualquier topic suscrito
  client.on('message', (topic, message) => {
    try {
      // Convierte el mensaje de buffer a string y luego a objeto JSON
      const data = JSON.parse(message.toString());

      // Llama al callback recibido desde React con los datos
      if (onMessageCallback) onMessageCallback(data);
    } catch (error) {
      console.error('Error al parsear mensaje:', error);
    }
  });

  // Evento que captura errores de conexión o comunicación MQTT
  client.on('error', (err) => {
    console.error('Error en MQTT:', err);
  });
}

/**
 * Función para publicar un mensaje desde la computadora hacia la Pico W (por MQTT).
 * @param {string} topic - El topic donde se quiere publicar (ej. 'picow/comandos')
 * @param {object} payload - Objeto que será enviado como JSON
 */
export function publishToPico(topic, payload) {
  // Verifica que el cliente esté conectado al broker antes de publicar
  if (client && client.connected) {
    // Convierte el objeto a string JSON y lo envía al topic indicado
    client.publish(topic, JSON.stringify(payload));
  } else {
    console.warn('MQTT no está conectado.');
  }
}
