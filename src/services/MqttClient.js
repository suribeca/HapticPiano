// src/services/MqttClient.js
import { profiler } from "../utils/profiler";
import mqtt from "mqtt";

let client = null;
let onMessageRef = null;  // 🔥 guarda siempre el callback más reciente

export function connectMQTT(onMessage) {
  // 🔥 Actualizamos referencia del callback siempre
  onMessageRef = onMessage;

  // Si ya existe cliente, no volvemos a conectar
  if (client) {
    return client;
  }

  const url = process.env.REACT_APP_MQTT_URL || "ws://192.168.4.1:9001";
  console.log("[MQTT] Iniciando conexión a:", url);

  client = mqtt.connect(url, {
    protocol: "ws",
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 500,
    queueQoSZero: false,
    keepalive: 30
  });

  client.on("connect", () => {
    console.log("[MQTT] Conectado al broker");

    client.subscribe("picow/fingers", { qos: 0 }, (err) => {
      if (err) console.error("[MQTT] Error en suscripción:", err);
      else console.log("[MQTT] Suscrito a picow/fingers");
    });
  });

  client.on("message", (topic, payload) => {
    if (topic !== "picow/fingers") return;

    try {
      const data = JSON.parse(payload.toString());
      profiler.step("react-latency", "mqtt received");

      // 🔥 Ejecuta SIEMPRE el callback más actual
      if (onMessageRef) {
        onMessageRef(data);
      }
    } catch (err) {
      console.error("[MQTT] Error parseando mensaje:", err);
    }
  });

  client.on("error", (e) => console.error("[MQTT] Error:", e));
  client.on("close", () => console.log("[MQTT] Conexión cerrada"));
  client.on("offline", () => console.warn("[MQTT] Offline"));
  client.on("reconnect", () => console.log("[MQTT] Reintentando..."));

  return client;
}

// ===============================================================
//  P U B L I S H
// ===============================================================
export function publishFeedback(fingerStates) {
  if (!client || !client.connected) return;

  try {
    const payload = JSON.stringify(fingerStates);
    client.publish("web/pressed", payload, { qos: 0 });
  } catch (error) {
    console.error("[MQTT] Error publicando:", error);
  }
}

// ===============================================================
//  D I S C O N N E C T
// ===============================================================
export function disconnectMQTT(force = true) {
  if (client) {
    try {
      console.log("[MQTT] Cerrando conexión...");
      client.end(force);
    } catch (err) {
      console.error("[MQTT] Error al desconectar:", err);
    }
  }
  client = null;
  onMessageRef = null;   // 🔥 reseteamos callback
}

// Helpers
export function isConnected() {
  return client?.connected || false;
}

export function getClient() {
  return client;
}
