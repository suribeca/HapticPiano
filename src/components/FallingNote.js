import React, { useEffect, useRef, useState } from 'react';
import './FallingNote.css';
import { MIDI_TO_NOTE } from '../global/constants'; // Asegúrate de importar correctamente

export function FallingNote({
  note,
  time,
  duration = 3,
  containerHeight = 300,
  onEnd,
  practiceMode = false,
  pressedNotes = []
}) {
  const [start, setStart] = useState(false);
  const [leftPos, setLeftPos] = useState(null);
  const [progress, setProgress] = useState(0); // 0 a 1
  const requestRef = useRef();
  const startTimeRef = useRef();


  useEffect(() => {
    const delay = time * 1000;

    const timer = setTimeout(() => {
      // Mapea número MIDI a nombre de nota (ej: 60 → "do4")
      const noteName = MIDI_TO_NOTE[note];

      // Busca el elemento DOM correspondiente a esa tecla
      const keyElement = document.getElementById(noteName);

      //Detecta el contenedor del piano
      const container = document.querySelector('.piano-container')?.getBoundingClientRect();
      if (keyElement) {
        const rect = keyElement.getBoundingClientRect();
        const container = document.querySelector('.piano-container').getBoundingClientRect();
        const position = rect.left - container.left + keyElement.offsetWidth / 4;
        setLeftPos(position);
        setStart(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [note, time]);

 // Animación frame a frame (modo práctica o no)
  useEffect(() => {
    if (!start) return;

    const noteName = MIDI_TO_NOTE[note];
    const animation = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      let progressRatio = elapsed / duration;

      if (practiceMode) {
        if (!pressedNotes.includes(noteName) && progressRatio > 0.83) {
          progressRatio = 0.83; // Congela al 83% (por ejemplo, top: 250px)
        }
      }

      setProgress(progressRatio);

      if (progressRatio < 1) {
        requestRef.current = requestAnimationFrame(animation);
      } else {
        onEnd?.();
      }
    };

    requestRef.current = requestAnimationFrame(animation);
    return () => cancelAnimationFrame(requestRef.current);
  }, [start, pressedNotes, practiceMode]);

  if (!start || leftPos === null) return null;

  const topPos = Math.min(progress * containerHeight, containerHeight);

  return (
    <div
      className="falling-note"
      style={{
        left: `${leftPos}px`,
        animationDuration: `${duration}s`,
        top: `${topPos}px`,
      }}
    />
  );
}