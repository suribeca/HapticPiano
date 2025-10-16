// src/hooks/useScoreFace.js
import { useEffect, useRef, useState } from 'react';

/**
 * Hook para estado visual de la carita según el último puntaje.
 * - Depende SOLO de lastScore (0, 50, 100) y del mode 'cancion'.
 * - Colores asemejan el feedback visual al feedback háptico.
 */
export const useScoreFace = (mode, lastScore, colors) => {
  const INACTIVE = colors?.inactive || '#777777';
  const PERFECT  = colors?.perfect  || '#00C853'; 
  const GOOD     = colors?.good     || '#2962FF'; 
  const MISS     = colors?.miss     || '#D50000'; 

  const [face, setFace] = useState({ mood: 'neutral', color: INACTIVE });

  // Recuerda el puntaje con el que entraste al modo canción
  const entryScoreRef = useRef(null);
  // Indica si ya vimos el primer “score real” (primer cambio) tras entrar
  const activatedRef = useRef(false);

  // Cuando cambie el modo: resetear a neutral y “armar” el detector de primer cambio
  useEffect(() => {
    if (mode === 'cancion') {
      entryScoreRef.current = lastScore;  // recuerda el valor con el que entraste (aunque sea 0)
      activatedRef.current = false;       // aún no activado
      setFace({ mood: 'neutral', color: INACTIVE });
    } else {
      // En modo libre u otros, carita siempre neutral
      entryScoreRef.current = null;
      activatedRef.current = false;
      setFace({ mood: 'neutral', color: INACTIVE });
    }
    
  }, [mode]);

  useEffect(() => {
    if (mode !== 'cancion') return;

    // Si todavía no queremos activar (no ha cambiado respecto al valor de entrada), quedarnos neutral
    const entryScore = entryScoreRef.current;

    // Caso 1: no hay puntaje aún (null/undefined) → neutral
    if (lastScore == null) {
      setFace({ mood: 'neutral', color: INACTIVE });
      return;
    }

    // Caso 2: aún no activado y lastScore sigue igual que al entrar → mantener neutral
    if (!activatedRef.current && lastScore === entryScore) {
      setFace({ mood: 'neutral', color: INACTIVE });
      return;
    }

    // A partir de aquí, ya consideramos un puntaje “real”
    activatedRef.current = true;

    if (lastScore === 100) {
      setFace({ mood: 'happyOpen', color: PERFECT });
    } else if (lastScore === 50) {
      setFace({ mood: 'happy', color: GOOD });
    } else if (lastScore === 0) {
      setFace({ mood: 'sad', color: MISS });
    } else {
      setFace({ mood: 'neutral', color: INACTIVE });
    }
  }, [mode, lastScore, INACTIVE, PERFECT, GOOD, MISS]);

  return face;
};