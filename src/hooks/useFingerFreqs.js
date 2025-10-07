import { useEffect } from 'react';

/**
 * Hook para manejar las frecuencias de los dedos según el estado y la última nota
 * @param {string} mode - Modo de juego: 'libre' | 'cancion'
 * @param {Object} fingerStatus - Estado actual de los dedos {thumb, index, middle, ring, pinky}
 * @param {string|null} lastNote - Última nota MIDI presionada (ej. "do4") o null
 * @param {string|null} lastActiveFinger - Último dedo que se activó
 * @param {Function} noteToFreq - Función que convierte nota MIDI a frecuencia (Hz)
 * @param {Function} setFingerFreqs - Setter del estado fingerFreqs
 * @param {Function} setLastActiveFinger - Setter para actualizar el último dedo activo
 */
export const useFingerFreqs = (
  mode,
  fingerStatus, 
  lastNote, 
  lastActiveFinger,
  noteToFreq, 
  setFingerFreqs,
  setLastActiveFinger
) => {

  // Cuando cambien los dedos o la última nota, recalculamos frecuencias
  useEffect(() => {
    // Si no hay nota, todas las frecuencias a 0
    if (!lastNote) {
      setFingerFreqs({
        thumb: 0,
        index: 0,
        middle: 0,
        ring: 0,
        pinky: 0,
      });
      return;
    }

    const updated = {};
    let newActiveFinger = null;

    for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
      const pressed = fingerStatus[finger] || false;
      
      if (mode === 'cancion') {
        // En modo canción: solo vibra el dedo que está presionando ahora
        if (pressed) {
          updated[finger] = noteToFreq(lastNote);
          newActiveFinger = finger; // Guardamos cuál dedo se activó
        } else {
          updated[finger] = 0;
        }
      } else {
        // En modo libre: vibran todos los dedos activos
        updated[finger] = pressed ? noteToFreq(lastNote) : 0;
      }
    }

    setFingerFreqs(updated);
    
    // Actualizar el último dedo activo solo si cambió
    if (newActiveFinger && newActiveFinger !== lastActiveFinger) {
      setLastActiveFinger(newActiveFinger);
    }
    
  }, [fingerStatus, lastNote, noteToFreq, setFingerFreqs, mode, lastActiveFinger, setLastActiveFinger]);

};