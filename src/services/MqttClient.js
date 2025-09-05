// src/services/MqttClient.js
// Cliente MQTT para front-end (React) usando MQTT.js y WebSockets contra Mosquitto.
// - Se conecta a un broker por WS (puerto 9001 típico en Mosquitto).
// - Se suscribe a 'picow/fingers' (estados que publica la Pico).
// - Publica a 'web/pressed' (feedback de color/frecuencia para la Pico).
// - Expone helpers: connectMQTT, publishFeedback, disconnectMQTT.

import mqtt from "mqtt";

// Guardamos una referencia única al cliente para evitar conexiones duplicadas.
let client = null;

/**
 * Conecta al broker MQTT (WebSockets) y registra un callback para mensajes entrantes.
 * @param {Function} onMessage - callback que recibe los datos del topic 'picow/fingers'
 *                               (objeto con {thumb:boolean, index:boolean, ...})
 */
export function connectMQTT(onMessage) {
  // Si ya existe un cliente y está conectado, lo reutilizamos.
  if (client?.connected) return client;

  // URL del broker en WebSockets: la traemos de .env (REACT_APP_MQTT_URL) o usamos localhost por defecto.
  // Ejemplo de .env: REACT_APP_MQTT_URL=ws://192.168.1.50:9001
  const url = process.env.REACT_APP_MQTT_URL || "ws://localhost:9001";

  // Creamos la conexión con MQTT.js. Como es WS, NO hacen falta credenciales ni TLS en LAN.
  client = mqtt.connect(url, {
    protocol: "ws",      // Forzamos protocolo WebSockets (imprescindible en navegador).
    clean: true,         // Sesión limpia: no reanuda suscripciones pendientes del lado del broker.
    connectTimeout: 4000,// Tiempo máximo para establecer conexión (ms).
    reconnectPeriod: 1000// Si se cae, intenta reconectar cada 1s.
    // Opcionales útiles:
    // queueQoSZero: false, // NO bufferizar mensajes QoS0 si estamos desconectados (latencia > fiabilidad).
  });

  // Evento: conexión establecida con el broker.
  client.on("connect", () => {
    console.log("✅ Conectado a Mosquitto (WS):", url);

    // Nos suscribimos al topic donde la Pico publica el estado de sus sensores (dedos).
    client.subscribe("picow/fingers", (err) => {
      if (err) console.error("Error al suscribirse:", err);
      // Nota: si quisieras más topics, se pueden agregar aquí.
    });
  });

  // Evento: recepción de mensajes. Llega para TODOS los topics suscritos.
  client.on("message", (topic, payload) => {
    // Solo procesamos el topic que nos interesa en este cliente.
    if (topic !== "picow/fingers") return;

    try {
      // La Pico publica JSON con booleanos por dedo, lo parseamos.
      // Ej: {"thumb":true,"index":false,"middle":true,"ring":false,"pinky":false}
      const data = JSON.parse(payload.toString());

      // Disparamos el callback recibido desde Piano.js (si existe).
      onMessage && onMessage(data);
    } catch (e) {
      console.error("Error al parsear MQTT:", e);
    }
  });

  // Evento: errores de red o del broker (útil para debug).
  client.on("error", (err) => console.error("MQTT error:", err));

  // Checar eventos: 
  // client.on("reconnect", () => console.log("Reconectando a MQTT..."));
  // client.on("close", () => console.log("Conexión MQTT cerrada"));
  // client.on("offline", () => console.log("MQTT offline"));

  return client;
}

/**
 * Publica feedback para la Pico en el topic 'web/pressed'.
 * @param {Object} fingerStates - Mapa por dedo con { pressed, color, freq }.
 *   Ej:
 *   {
 *     "thumb":  { pressed: true,  color:"#00ff00", freq:50000 },
 *     "index":  { pressed: false, color:"#cccccc", freq:0 },
 *     "middle": { pressed: true,  color:"#00ff00", freq:52000 },
 *     ...
 *   }
 * - 'pressed' lo usa el front para decidir color/intensidad; en la Pico la DECISIÓN final de encendido depende del sensor físico (baja latencia).
 * - 'color' es #RRGGBB (la Pico lo convierte a 16 bits por canal).
 * - 'freq' mapea a duty_u16 (0..65535) del PWM del motor (intensidad háptica).
 */
export function publishFeedback(fingerStates) {
  // Si la conexión no está lista, evitamos publicar (y avisamos).
  if (!client || !client.connected) {
    console.warn("MQTT no conectado");
    return;
  }

  // Publicamos con QoS 0 (rápido, sin confirmación). Perfecto para feedback en tiempo real.
  client.publish("web/pressed", JSON.stringify(fingerStates), { qos: 0 });
}

/**
 * Cierra la conexión MQTT (se recomienda al desmontar el componente o salir de la vista).
 */
export function disconnectMQTT() {
  if (client) {
    try {
      // end(true) corta inmediatamente sin esperar ACKs; ideal para cerrar al navegar.
      client.end(true);
    } catch {}
    client = null;
  }
}