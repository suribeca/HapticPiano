import React, { useEffect, useRef, useState } from 'react';
import './FallingNote.css';
import { MIDI_TO_NOTE } from '../global/constants';

/**
 * Nota descendente animada. Cae según tiempo `time`, y se congela si no es presionada (modo práctica).
 */
export function FallingNote({
  id,
  note,
  time,
  duration = 3,
  containerHeight = 300,
  onEnd,
  practiceMode = false,
  pressedNotes = []
}) {
  const [left, setLeft] = useState(null);          // Posición horizontal
  const [rendered, setRendered] = useState(false); // Mostrar en DOM
  const [frozen, setFrozen] = useState(false);     // Nota congelada

  const noteName = MIDI_TO_NOTE[note];
  const requestRef = useRef();
  const startAt = useRef(performance.now() + time * 1000); // Tiempo objetivo para iniciar animación

  // Ubica la nota visualmente encima de la tecla correspondiente
  useEffect(() => {
    const key = document.getElementById(noteName);
    const container = document.querySelector('.piano-container')?.getBoundingClientRect();
    if (key && container) {
      const keyRect = key.getBoundingClientRect();
      const leftPos = keyRect.left - container.left + key.offsetWidth / 4;
      setLeft(leftPos);
      setRendered(true);
    }
  }, [noteName]);

  // Animación continua controlada por tiempo
  useEffect(() => {
    if (left === null) return;

    const animate = (now) => {
      const elapsed = (now - startAt.current) / 1000; // Tiempo desde el inicio programado
      let progress = elapsed / duration;

      if (progress < 0) {
        requestRef.current = requestAnimationFrame(animate); // Aún no inicia
        return;
      }

      // Modo práctica: congela si no se presionó
      if (practiceMode && !pressedNotes.includes(noteName) && progress >= 0.83) {
        progress = 0.83;
        setFrozen(true);
      }

      const top = Math.min(progress * containerHeight, containerHeight);

      // Mueve visualmente
      const el = document.getElementById(`falling-${id}`);
      if (el) {
        el.style.top = `${top}px`;
      }

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else if (!practiceMode || pressedNotes.includes(noteName)) {
        onEnd?.(id);
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [left, practiceMode, pressedNotes, id, duration, containerHeight, onEnd, noteName]);

  // Cuando se congela pero luego se toca correctamente
  useEffect(() => {
    if (frozen && pressedNotes.includes(noteName)) {
      onEnd?.(id);
    }
  }, [pressedNotes, frozen, noteName, id, onEnd]);

  if (!rendered || left === null) return null;

  return (
    <div
      id={`falling-${id}`}
      className="falling-note"
      style={{
        left: `${left}px`,
        top: `-30px`, // Empieza arriba del contenedor
        width: '30px',
        height: '30px',
        position: 'absolute',
        backgroundColor: frozen ? '#888' : '#00BFFF',
        borderRadius: '5px',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    />
  );
}
