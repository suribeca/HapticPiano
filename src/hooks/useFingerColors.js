import { useEffect } from 'react';

/**
 * Hook para manejar los colores de los dedos según el modo y estado
 * @param {string} mode - Modo de juego: 'libre' | 'cancion'
 * @param {Object} fingerStatus - Estado actual de los dedos
 * @param {Array} pressedNotes - Notas MIDI actualmente presionadas
 * @param {number} lastScore - Último puntaje obtenido (0, 50, 100)
 * @param {string|null} lastActiveFinger - Último dedo que se activó ('thumb', 'index', etc.)
 * @param {Function} setFingerColors - Setter del estado fingerColors
 * @param {Object} colors - Paleta de colores
 */
export const useFingerColors = (
  mode, 
  fingerStatus, 
  pressedNotes, 
  lastScore, 
  lastActiveFinger,
  setFingerColors, 
  colors
) => {
  
  // Modo Libre: dedos activos solo si sensor Y hay nota MIDI presionada
  useEffect(() => {
    if (mode !== 'libre') return;
    
    setFingerColors(prev => {
      const next = { ...prev };
      const hasNotesPressed = pressedNotes && pressedNotes.length > 0;
      
      for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
        // Solo activo si el sensor está presionado Y hay notas MIDI activas
        const isActive = (fingerStatus && fingerStatus[f]) && hasNotesPressed;
        next[f] = isActive ? colors.active : colors.idle;
      }
      return next;
    });
  }, [fingerStatus, pressedNotes, mode, colors.active, colors.idle, setFingerColors]);

  // Modo Canción: colores según el puntaje obtenido
  useEffect(() => {
    if (mode !== 'cancion' || lastScore === null) return;

    let color;
    if (lastScore === 100) color = colors.perfect;
    else if (lastScore === 50) color = colors.good;
    else if (lastScore === 0) color = colors.miss;
    else return; // No hacer nada si el score no es válido

    setFingerColors(prev => {
      const next = { ...prev };
      
      if (lastActiveFinger) {
        // Caso 1: Se tocó una nota (correcta o incorrecta)
        // Solo iluminar el dedo que la tocó con el color del puntaje
        for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
          next[f] = (f === lastActiveFinger) ? color : colors.idle;
        }
      } else {
        // Caso 2: NO se tocó la nota (timeout/miss completo)
        // Toda la mano en ROJO
        for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
          next[f] = colors.miss;
        }
      }
      
      return next;
    });
  }, [lastScore, lastActiveFinger, mode, colors.perfect, colors.good, colors.miss, colors.idle, setFingerColors]);
};