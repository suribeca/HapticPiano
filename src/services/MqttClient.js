// src/services/MqttClient.js
// Cliente MQTT optimizado para comunicación de baja latencia entre React y Pico W
// 
// Arquitectura:
// - Conexión WebSocket al broker Mosquitto (puerto 9001)
// - Suscripción: 'picow/fingers' - Estados de sensores desde Pico W
// - Publicación: 'web/pressed' - Feedback de actuadores hacia Pico W
//


import mqtt from "mqtt";

let client = null;

/**
 * Establece conexión con el broker MQTT y configura callback para mensajes entrantes
 * 
 * @param {Function} onMessage - Callback ejecutado al recibir datos de 'picow/fingers'
 *                               Recibe objeto: {thumb: boolean, index: boolean, ...}
 * @returns {Object} Instancia del cliente MQTT
 * 
 * Configuración optimizada para latencia:
 * - clean: true - Sesión limpia sin estado previo
 * - queueQoSZero: false - No bufferizar mensajes QoS 0 offline
 * - reconnectPeriod: 500ms - Reconexión rápida
 */
export function connectMQTT(onMessage) {
  if (client?.connected) {
    console.log("[MQTT] Cliente ya conectado, reutilizando conexión");
    return client;
  }

  const url = process.env.REACT_APP_MQTT_URL || "ws://192.168.4.1:9001";
  console.log("[MQTT] Iniciando conexión a:", url);

  client = mqtt.connect(url, {
    protocol: "ws",
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 500,      // Reducido de 1000ms a 500ms
    queueQoSZero: false,       // No bufferizar QoS 0 - prioriza latencia
    keepalive: 30              // Reducido de 60s a 30s para detectar desconexiones más rápido
  });

  client.on("connect", () => {
    console.log("[MQTT] Conectado al broker");
    
    // Suscripción con QoS 0 para máxima velocidad
    client.subscribe("picow/fingers", { qos: 0 }, (err) => {
      if (err) {
        console.error("[MQTT] Error en suscripción:", err);
      } else {
        console.log("[MQTT] Suscrito a picow/fingers");
      }
    });
  });

  // Procesamiento de mensajes - ejecuta callback inmediatamente sin delays
  client.on("message", (topic, payload) => {
    if (topic !== "picow/fingers") return;

    try {
      const data = JSON.parse(payload.toString());
      
      // Ejecutar callback sin setTimeout ni debouncing
      // para procesamiento inmediato
      if (onMessage) {
        onMessage(data);
      }
    } catch (error) {
      console.error("[MQTT] Error parseando mensaje:", error);
    }
  });

  client.on("error", (error) => {
    console.error("[MQTT] Error de conexión:", error);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Intentando reconexión...");
  });

  client.on("close", () => {
    console.log("[MQTT] Conexión cerrada");
  });

  client.on("offline", () => {
    console.warn("[MQTT] Cliente offline");
  });

  return client;
}

/**
 * Publica estado de actuadores hacia la Pico W
 * 
 * @param {Object} fingerStates - Estado por dedo con propiedades:
 *   {
 *     "thumb":  { pressed: boolean, color: string, freq: number },
 *     "index":  { pressed: boolean, color: string, freq: number },
 *     ...
 *   }
 * 
 * Propiedades:
 * - pressed: Estado del actuador (true/false)
 * - color: Color LED en formato hexadecimal #RRGGBB
 * - freq: Intensidad PWM del motor (0-65535)
 * 
 * Publicación con QoS 0 (at most once):
 * - Sin confirmación de entrega
 * - Mínima latencia
 * - Apropiado para datos de control en tiempo real donde
 *   el siguiente mensaje reemplaza al anterior
 */
export function publishFeedback(fingerStates) {
  if (!client || !client.connected) {
    console.warn("[MQTT] No conectado - descartando mensaje");
    return;
  }

  try {
    const payload = JSON.stringify(fingerStates);
    
    // QoS 0: Máxima velocidad, sin garantías de entrega
    // Apropiado para feedback continuo donde mensajes posteriores
    // actualizan el estado completo
    client.publish("web/pressed", payload, { qos: 0 }, (error) => {
      if (error) {
        console.error("[MQTT] Error publicando:", error);
      }
    });
  } catch (error) {
    console.error("[MQTT] Error serializando payload:", error);
  }
}

/**
 * Cierra la conexión MQTT de forma limpia
 * Debe llamarse al desmontar el componente o cambiar de vista
 * 
 * @param {boolean} force - Si true, cierra inmediatamente sin esperar ACKs
 */
export function disconnectMQTT(force = true) {
  if (client) {
    try {
      console.log("[MQTT] Cerrando conexión...");
      client.end(force);
      client = null;
      console.log("[MQTT] Desconectado");
    } catch (error) {
      console.error("[MQTT] Error al desconectar:", error);
      client = null;
    }
  }
}

/**
 * Verifica el estado de la conexión MQTT
 * @returns {boolean} true si está conectado, false en caso contrario
 */
export function isConnected() {
  return client?.connected || false;
}

/**
 * Obtiene la instancia actual del cliente MQTT
 * Útil para operaciones avanzadas o debugging
 * @returns {Object|null} Instancia del cliente o null
 */
export function getClient() {
  return client;
}