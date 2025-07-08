import React, { useEffect, useRef, useState } from 'react';
import './FallingNote.css';
import { MIDI_TO_NOTE } from '../global/constants';

/**
 * Componente que representa una nota que cae visualmente sobre el piano.
 * @param {number} note - Número MIDI de la nota.
 * @param {number} time - Tiempo en segundos cuando la nota debe empezar a caer.
 * @param {number} duration - Duración total que tarda en caer la nota (segundos).
 * @param {number} containerHeight - Altura del contenedor para calcular posición vertical.
 * @param {function} onEnd - Callback que se llama cuando la nota termina su animación o se elimina.
 * @param {boolean} practiceMode - Indica si se está en modo práctica (con congelamiento).
 * @param {string[]} pressedNotes - Lista de nombres de notas actualmente presionadas.
 * @param {boolean} freezeAll - Estado global de congelamiento de notas.
 * @param {function} setGlobalFreeze - Setter para activar/desactivar congelamiento global.
 */
export function FallingNote({
  note,
  time,
  duration = 3,
  containerHeight = 300,
  onEnd,
  practiceMode = false,
  pressedNotes = [],
  freezeAll = false,
  setGlobalFreeze = () => {}
}) {
  const [start, setStart] = useState(false);
  const [leftPos, setLeftPos] = useState(null);
  const [progress, setProgress] = useState(0);

  const requestRef = useRef();
  const startTimeRef = useRef();
  const frozenRef = useRef(false);
  const freezeTimeRef = useRef(null);
  const localFreezeProgressRef = useRef(null);
  const alreadyClearedRef = useRef(false); // Para evitar que se borre dos veces

  const noteName = MIDI_TO_NOTE[note];

  // Esperar el tiempo indicado para iniciar la caída
  useEffect(() => {
    const delay = time * 1000;
    const timer = setTimeout(() => {
      const keyElement = document.getElementById(noteName);
      const container = document.querySelector('.piano-container')?.getBoundingClientRect();
      if (keyElement && container) {
        const rect = keyElement.getBoundingClientRect();
        const position = rect.left - container.left + keyElement.offsetWidth / 4;
        setLeftPos(position);
        setStart(true);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [note, time, noteName]);

  useEffect(() => {
    if (!start) return;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;

      // Tiempo transcurrido desde el inicio de animación (segundos)
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const currentProgress = elapsed / duration;

      const isPressed = pressedNotes.includes(noteName);
      const inHitZone = currentProgress >= 0.9 && currentProgress < 0.99;

      // Caso 1: Si la nota está en zona válida y usuario presionó la tecla, eliminar nota
      if (isPressed && inHitZone && !alreadyClearedRef.current) {
        alreadyClearedRef.current = true;
        onEnd?.();
        return; // detener animación para esta nota
      }

      // Caso 2: Si modo práctica y la nota llegó casi al final sin presionarse, congelar
      if (practiceMode && currentProgress >= 0.99 && !isPressed && !frozenRef.current) {
        frozenRef.current = true;
        freezeTimeRef.current = timestamp;
        localFreezeProgressRef.current = currentProgress;
        setGlobalFreeze(true); // congela globalmente
        setProgress(currentProgress);
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      // Caso 3: Si ya congelada y ahora la presionan, liberar congelamiento
      if (frozenRef.current && isPressed) {
        const freezeDuration = timestamp - freezeTimeRef.current;
        startTimeRef.current += freezeDuration; // Ajusta tiempo para continuar animación
        frozenRef.current = false;
        localFreezeProgressRef.current = null;
        setGlobalFreeze(false);
      }

      // Caso 4: En caso de freezeAll (congelamiento global), mantener posición
      if (freezeAll && !frozenRef.current) {
        if (localFreezeProgressRef.current === null) {
          localFreezeProgressRef.current = currentProgress;
        }
        setProgress(localFreezeProgressRef.current);
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      // Caso 5: Al llegar al final sin presionar (modo no práctica), eliminar nota
      if (currentProgress >= 1 && !alreadyClearedRef.current) {
        alreadyClearedRef.current = true;
        onEnd?.();
        return;
      }

      // Actualizar progreso normalmente
      setProgress(currentProgress);

      // Continuar animación si no se eliminó
      if (!alreadyClearedRef.current) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, [start, pressedNotes, practiceMode, freezeAll, noteName, setGlobalFreeze]);

  if (!start || leftPos === null) return null;

  const topPos = Math.min(progress * containerHeight, containerHeight);

  return (
    <div
      className="falling-note"
      style={{
        left: `${leftPos}px`,
        top: `${topPos}px`
      }}
    />
  );
}
