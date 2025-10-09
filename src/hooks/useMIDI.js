import { useEffect, useCallback, useRef } from 'react';
import { MIDI_TO_NOTE } from '../global/constants';

/**
 * Hook para conexión y eventos MIDI (soporta cualquier canal y hot-plug)
 * @param {Function} onNoteOn - Callback cuando se presiona una nota (noteName)
 * @param {Function} onNoteOff - Callback cuando se suelta una nota (noteName)
 */
export const useMIDI = (onNoteOn, onNoteOff) => {
  const midiAccessRef = useRef(null);

  const handleMIDIMessage = useCallback(({ data }) => {
    // data = [status, noteNumber, velocity]
    const [status, noteNumber, velocity = 0] = data || [];

    // Enmascara canal: 0x8* = Note Off, 0x9* = Note On
    const isNoteOn = (status & 0xF0) === 0x90 && velocity > 0;
    const isNoteOff = (status & 0xF0) === 0x80 || ((status & 0xF0) === 0x90 && velocity === 0);

    const noteName = MIDI_TO_NOTE[noteNumber];
    if (!noteName) {
      // Log opcional para depurar rangos/octavas inesperadas
      // console.debug('Nota fuera de mapa:', noteNumber, data);
      return;
    }

    if (isNoteOn && onNoteOn) onNoteOn(noteName);
    if (isNoteOff && onNoteOff) onNoteOff(noteName);
  }, [onNoteOn, onNoteOff]);

  const attachAllInputs = useCallback((midiAccess) => {
    // Limpia handlers previos para evitar duplicados
    midiAccess.inputs.forEach((input) => {
      input.onmidimessage = null;
    });

    // Reasigna a todas las entradas disponibles
    const inputs = Array.from(midiAccess.inputs.values());
    console.log('Entradas MIDI detectadas:', inputs.map(i => i.name));

    inputs.forEach((input) => {
      try {
        input.onmidimessage = handleMIDIMessage;
        console.log(`✅ Escuchando: ${input.name} (id: ${input.id})`);
      } catch (e) {
        console.warn(`No se pudo adjuntar a ${input.name}`, e);
      }
    });
  }, [handleMIDIMessage]);

  const onMIDISuccess = useCallback((midiAccess) => {
    console.log('MIDI conectado exitosamente');
    midiAccessRef.value = midiAccess;

    attachAllInputs(midiAccess);

    // Maneja hot-plug / cambios de estado (conectar/desconectar)
    midiAccess.onstatechange = (event) => {
      const port = event.port;
      console.log(`ℹ️ Estado cambiado: [${port.type}] ${port.name} → ${port.state}/${port.connection}`);
      attachAllInputs(midiAccess);
    };
  }, [attachAllInputs]);

  const onMIDIFailure = useCallback((err) => {
    console.error('❌ No se pudo acceder a dispositivos MIDI.', err);
  }, []);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API no está disponible en este navegador');
      return;
    }

    // sysex:false por defecto; localhost/https requerido
    navigator.requestMIDIAccess({ sysex: false })
      .then(onMIDISuccess)
      .catch(onMIDIFailure);

    // Cleanup: quitar handlers si el componente se desmonta
    return () => {
      const midiAccess = midiAccessRef.value;
      if (midiAccess) {
        midiAccess.onstatechange = null;
        midiAccess.inputs.forEach((input) => {
          input.onmidimessage = null;
        });
      }
    };
  }, [onMIDISuccess, onMIDIFailure]);
};
