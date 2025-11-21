
import { useEffect, useRef } from 'react';
import { publishFeedback } from '../services/MqttClient';

// NUEVO: Hook que publica ANTES de que useFingerColors termine
export const useImmediateMQTTPublish = (fingerStatusRef, pressedNotes, noteToFreq) => {
  const lastPublishedRef = useRef(null);
  
  useEffect(() => {
    const status = fingerStatusRef.current;
    
    // Construir payload INMEDIATAMENTE con defaults
    const feedback = {};
    let hasActive = false;
    
    const fingerNames = ["thumb", "index", "middle", "ring", "pinky"];
    
    for (const finger of fingerNames) {
      if (status[finger]) {
        // Color por defecto basado en si hay nota presionada
        const defaultColor = pressedNotes.length > 0 ? "#00ff00" : "#cccccc";
        
        // Frecuencia por defecto basada en la nota
        let defaultFreq = 0;
        if (pressedNotes.length > 0) {
          const freq = noteToFreq(pressedNotes[pressedNotes.length - 1]);
          defaultFreq = Math.min(65535, Math.floor(freq * 10));
        }
        
        feedback[finger] = {
          pressed: true,
          color: defaultColor,
          freq: defaultFreq
        };
        hasActive = true;
      }
    }
    
    // Serializar para detectar cambios
    const currentState = JSON.stringify(feedback);
    
    // Solo publicar si hay cambios
    if (currentState !== lastPublishedRef.current) {
      lastPublishedRef.current = currentState;
      
      // PUBLICAR INMEDIATAMENTE
      publishFeedback(hasActive ? feedback : { __empty: true });
      
      console.log(`[IMMEDIATE] Publicado en ${performance.now().toFixed(2)}ms`);
    }
  }, [fingerStatusRef, pressedNotes, noteToFreq]);
};
