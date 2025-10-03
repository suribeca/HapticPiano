import { useEffect } from 'react';
import { publishFeedback } from '../services/MqttClient';

/**
 * Hook personalizado para publicar feedback MQTT de forma continua
 * @param {Object} fingerStatus - Estado de los dedos {thumb, index, middle, ring, pinky}
 * @param {Object} fingerColors - Colores de los dedos {thumb, index, middle, ring, pinky}
 * @param {Object} fingerFreqs - Frecuencias de los dedos {thumb, index, middle, ring, pinky}
 * @param {number} interval - Intervalo de publicación en ms (por defecto 75ms)
 */
export const useMQTTFeedback = (
  fingerStatus, 
  fingerColors, 
  fingerFreqs, 
  interval = 75
) => {
  useEffect(() => {
    const intervalId = setInterval(() => {
      const feedback = {};
      
      for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
        const pressed = fingerStatus[finger] || false;
        feedback[finger] = {
          pressed,
          color: fingerColors[finger],
          freq: fingerFreqs[finger],
        };
      }
      
      publishFeedback(feedback);
    }, interval);

    return () => clearInterval(intervalId);
  }, [fingerStatus, fingerColors, fingerFreqs, interval]);
};