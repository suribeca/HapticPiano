import React, { useEffect, useRef, useState } from 'react';
import './FallingNote.css';
import { MIDI_TO_NOTE } from '../global/constants';

/**
 * Nota descendente animada.
 * @param {Object} props
 * @param {string} id - ID única para identificar la nota
 * @param {number} note - Número MIDI
 * @param {number} time - Tiempo en segundos en que debe aparecer
 * @param {number} duration - Duración total de caída en segundos
 * @param {number} containerHeight - Altura del contenedor visual
 * @param {function} onScore - Callback para registrar puntaje y offset
 * @param {function} onEnd - Callback para eliminar nota del DOM
 * @param {string[]} pressedNotes - Notas actualmente presionadas
 */
export function FallingNote({
  id,
  note,
  time,
  duration = 3,
  containerHeight = 300,
  onScore = (score, offsetMs) => { },
  onEnd,
  pressedNotes = []
}) {
  const [left, setLeft] = useState(null);
  const [rendered, setRendered] = useState(false);
  const [active, setActive] = useState(false);

  const noteName = MIDI_TO_NOTE[note];
  const requestRef = useRef();
  const scored = useRef(false); // ✅ para evitar múltiples puntajes
  const startAt = useRef(performance.now() + time * 1000);

  //==============================================================
  // Efectos y logica
  //==============================================================
  
  // Posicionamiento inicial
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

  // Animación
  useEffect(() => {
    if (left === null) return;

    const animate = (now) => {
      const elapsed = (now - startAt.current) / 1000;
      const progress = elapsed / duration;
      const top = Math.min(progress * containerHeight, containerHeight);

      const el = document.getElementById(`falling-${id}`);
      if (el) {
        el.style.top = `${top}px`;
      }

      const idealProgress = 0.85;
      const offsetMs = (progress - idealProgress) * duration * 1000;

      if (!scored.current && pressedNotes.includes(noteName)) {
        if (Math.abs(offsetMs) <= 70) {
          onScore(100, offsetMs);
          scored.current = true;
          onEnd?.(id);
          return;
        } else if (Math.abs(offsetMs) <= 135) {
          onScore(50, offsetMs);
          scored.current = true;
          onEnd?.(id);
          return;
        }
        else if (Math.abs(offsetMs) <= 200) {
          onScore(0, offsetMs);
          scored.current = true;
          onEnd?.(id);
          return;
        }
      }

      if (!active && !pressedNotes.includes(noteName) && progress >= 0.80 && progress <= 0.94) {
        setActive(true); // verde cuando en zona de acierto pero no presionada
      }

      if (!pressedNotes.includes(noteName) && progress >= 0.94 && !scored.current) {
        onScore(0, offsetMs); // miss
        scored.current = true;
        onEnd?.(id);
        return;
      }

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else if (pressedNotes.includes(noteName)) {
        onEnd?.(id);
      }
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [left, pressedNotes, id, duration, containerHeight, onEnd, noteName, onScore]);

  if (!rendered || left === null) return null;

  //==============================================================
  // Render
  //==============================================================
  return (
    <div
      id={`falling-${id}`}
      className="falling-note"
      style={{
        left: `${left}px`,
        top: `-30px`,
        width: '30px',
        height: '30px',
        position: 'absolute',
        backgroundColor: active ? '#00BB00' : '#00BFFF',
        borderRadius: '5px',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    />
  );
}