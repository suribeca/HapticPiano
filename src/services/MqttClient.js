import mqtt from 'mqtt';

let client = null;

export function connectMQTT(onMessageCallback) {
  if (client) return;

  const options = {
    username: 'PianoBroker',
    password: 'PapaPitufo420',
    protocol: 'wss',
    port: 8884,
    connectTimeout: 4000,
    clean: true,
    reconnectPeriod: 1000,
  };

  client = mqtt.connect('wss://dae3db229f2d427b820bf6346fece546.s1.eu.hivemq.cloud:8884/mqtt', options);

  client.on('connect', () => {
    console.log('Conectado a MQTT');
    client.subscribe('picow/fingers', (err) => {
      if (err) console.error('Error al suscribirse:', err);
    });
  });

  client.on('message', (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      if (onMessageCallback) onMessageCallback(data);
    } catch (error) {
      console.error('Error al parsear mensaje:', error);
    }
  });

  client.on('error', (err) => {
    console.error('Error en MQTT:', err);
  });
}
