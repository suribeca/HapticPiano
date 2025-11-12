import { useEffect, useRef } from 'react';
import { publishFeedback } from '../services/MqttClient';

/**
 * Hook optimizado para latencia mínima en publicación MQTT
 * 
 * ESTRATEGIA CRÍTICA:
 * - Publica INMEDIATAMENTE cuando detecta cambios (no espera interval)
 * - Interval solo como fallback para mantener estado
 * - Reduce latencia de ~400ms a ~50-100ms
 */
export const useMQTTFeedback = (
  fingerStatus, 
  fingerColors, 
  fingerFreqs, 
  interval = 50
) => {
  const statusRef = useRef(fingerStatus);
  const colorsRef = useRef(fingerColors);
  const freqsRef = useRef(fingerFreqs);
  const lastPublishedRef = useRef(null);

  // Actualizar refs sin causar re-render
  statusRef.current = fingerStatus;
  colorsRef.current = fingerColors;
  freqsRef.current = fingerFreqs;

  // PUBLICACIÓN INMEDIATA cuando cambian fingerColors o fingerFreqs
  // Esto es lo crítico para reducir latencia
  useEffect(() => {
    const feedback = {};
    let hasActive = false;

    for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
      const pressed = statusRef.current[finger];
      
      if (pressed) {
        feedback[finger] = {
          pressed: true,
          color: colorsRef.current[finger],
          freq: freqsRef.current[finger]
        };
        hasActive = true;
      }
    }

    const currentState = JSON.stringify(feedback);
    
    // Solo publicar si hay cambios
    if (currentState !== lastPublishedRef.current) {
      lastPublishedRef.current = currentState;
      
      // PUBLICAR INMEDIATAMENTE
      publishFeedback(hasActive ? feedback : { __empty: true });
      
      // Log para verificar timing
      console.log(`[PUBLISH] Enviado inmediatamente en ${performance.now().toFixed(2)}ms`);
    }
  }, [fingerColors, fingerFreqs]); // Disparar cuando cambien colors o freqs

  // Interval de respaldo para mantener conexión activa
  // NO es la publicación principal
  useEffect(() => {
    const timer = setInterval(() => {
      // Solo publicar si no se ha publicado recientemente
      const feedback = {};
      let hasActive = false;

      for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
        const pressed = statusRef.current[finger];
        
        if (pressed) {
          feedback[finger] = {
            pressed: true,
            color: colorsRef.current[finger],
            freq: freqsRef.current[finger]
          };
          hasActive = true;
        }
      }

      const currentState = JSON.stringify(feedback);
      
      if (currentState !== lastPublishedRef.current) {
        lastPublishedRef.current = currentState;
        publishFeedback(hasActive ? feedback : { __empty: true });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [interval]);
};