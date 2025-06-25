import React, { useEffect, useState } from 'react';
import './FallingNote.css';
import { MIDI_TO_NOTE } from '../global/constants'; // Asegúrate de importar correctamente

export function FallingNote({ note, time, duration = 3, containerHeight = 300 }) {
  const [start, setStart] = useState(false);
  const [leftPos, setLeftPos] = useState(null);

  useEffect(() => {
    const delay = time * 1000;

    const timer = setTimeout(() => {
      // Mapea número MIDI a nombre de nota (ej: 60 → "do4")
      const noteName = MIDI_TO_NOTE[note];

      // Busca el elemento DOM correspondiente a esa tecla
      const keyElement = document.getElementById(noteName);
      if (keyElement) {
        const rect = keyElement.getBoundingClientRect();
        const container = document.querySelector('.piano-container').getBoundingClientRect();

        // Calcula la posición relativa dentro del piano-container
        const position = rect.left - container.left + keyElement.offsetWidth / 4;
        setLeftPos(position);
        setStart(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [note, time]);

  if (!start || leftPos === null) return null;

  return (
    <div
      className="falling-note"
      style={{
        left: `${leftPos}px`,
        animationDuration: `${duration}s`,
      }}
    />
  );
}
