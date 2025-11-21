
import { useEffect, useRef } from 'react';

// Hook de diagnóstico - agregar ANTES de useFingerColors
export const useFingerColorsTiming = (fingerStatus, pressedNotes, lastScore) => {
  const lastChangeTime = useRef(null);
  
  useEffect(() => {
    const now = performance.now();
    
    if (lastChangeTime.current) {
      const elapsed = now - lastChangeTime.current;
      console.log(`[TIMING] fingerStatus/pressedNotes cambió después de ${elapsed.toFixed(2)}ms`);
    }
    
    lastChangeTime.current = now;
  }, [fingerStatus, pressedNotes, lastScore]);
};
