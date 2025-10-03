import { useEffect, useCallback } from 'react';
import { MIDI_TO_NOTE } from '../global/constants';

/**
 * Hook personalizado para manejar la conexión y eventos MIDI
 * @param {Function} onNoteOn - Callback cuando se presiona una nota (recibe noteName)
 * @param {Function} onNoteOff - Callback cuando se suelta una nota (recibe noteName)
 */
export const useMIDI = (onNoteOn, onNoteOff) => {
  
  
  // Maneja mensajes MIDI entrantes
  const handleMIDIMessage = useCallback(({ data }) => {
    const [status, noteNumber, velocity] = data;
    const isNoteOn = status === 144 && velocity > 0;
    const isNoteOff = status === 128 || (status === 144 && velocity === 0);
    const noteName = MIDI_TO_NOTE[noteNumber];
    
    if (!noteName) return;

    if (isNoteOn && onNoteOn) {
      onNoteOn(noteName);
    }

    if (isNoteOff && onNoteOff) {
      onNoteOff(noteName);
    }
  }, [onNoteOn, onNoteOff]);

  // Callback exitoso de conexión MIDI
  const onMIDISuccess = useCallback((midiAccess) => {
    console.log(' MIDI conectado exitosamente');
    for (let input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }
  }, [handleMIDIMessage]);

  // Callback de error de conexión MIDI
  const onMIDIFailure = useCallback(() => {
    console.error('No se pudo acceder a dispositivos MIDI.');
  }, []);

  // Efecto para inicializar MIDI al montar el componente
  useEffect(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess()
        .then(onMIDISuccess)
        .catch(onMIDIFailure);
    } else {
      console.warn('Web MIDI API no está disponible en este navegador');
    }
  }, [onMIDISuccess, onMIDIFailure]);
};