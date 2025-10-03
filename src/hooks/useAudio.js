import { useRef, useCallback } from 'react';

//--------------------------------------------------------------
// Hooks de audio
//--------------------------------------------------------------

// Hook para convertir notas a frecuencias (duty cycle)
export const useNoteToFreq = (NOTES) => {
  const noteToFreq = useCallback((noteName) => {
    const index = NOTES.indexOf(noteName);
    if (index === -1) return 0;
    const ratio = index / NOTES.length;
    // graves -> duty alto (más fuerte), agudos -> duty menor (más suave)
    return Math.round(65500 - (ratio * (65500 - 20000)));
  }, [NOTES]);

  return noteToFreq;
};

// Hook para reproducir notas de audio
export const usePlayNote = () => {
  const audioRefs = useRef({});

  const playNote = useCallback((note) => {
    // Arreglo legacy para audios específicos 'la', 'zla', 'si'
    const match = note.match(/^(la|zla|si)(\d)$/);
    let correctedNote = note;
    if (match) {
      const [, base, octave] = match;
      correctedNote = `${base}${parseInt(octave) + 1}`;
    }
    const audio = audioRefs.current[correctedNote];
    if (audio && audio instanceof HTMLAudioElement) {
      audio.currentTime = 0;
      audio.play().catch(() => { });
    }
  }, []);

  return { playNote, audioRefs };
};
