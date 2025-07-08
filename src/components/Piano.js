// Importación de librerías necesarias y archivos del proyecto
import _ from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import './Piano.css'; // Estilos específicos para el componente Piano
import { Key } from './Key.js'; // Componente visual de cada tecla
import { Hand } from './Hand.js'; // Componente visual de la mano
import {
  NOTES,
  MIDI_TO_NOTE,
} from '../global/constants';
import { connectMQTT, publishFeedback } from '../services/MqttClient'; // Conexión a broker MQTT para intercambio de mensajes
import { FallingNote } from './FallingNote'; // Notas que caen visualmente
import './FallingNote.css'; // Estilos para las notas que caen (posición, color, animación, etc.)
import { useLocation, useNavigate } from 'react-router-dom';

export default function Piano() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode = 'cancion', song = 'ode', difficulty = 'practica' } = location.state || {};

  // Estado del componente
  const [pressedNotes, setPressedNotes] = useState([]);
  const [fingerColors, setFingerColors] = useState({
    thumb: "#cccccc",
    index: "#cccccc",
    middle: "#cccccc",
    ring: "#cccccc",
    pinky: "#cccccc"
  });
  const [fingerStatus, setFingerStatus] = useState({});
  const [fallingNotes, setFallingNotes] = useState([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [globalFreeze, setGlobalFreeze] = useState(false); // Estado global para congelamiento
  const [loadedNotes, setLoadedNotes] = useState([]); // almacena las notas cargadas del archivo

  const practiceMode = difficulty === 'practica';
  const pianoContainerRef = useRef(null);
  const prevFingerStatus = useRef({});
  const lastPublishedState = useRef({});
  const activeNotesRef = useRef([]);
  const practiceStartTime = useRef(null);

  // Se ejecuta al montar el componente
  useEffect(() => {
    if (mode === 'cancion' && (!song || !difficulty)) {
      navigate('/practica');
      return;
    }

    console.log("🎹 Modo actual:", mode);

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
      console.warn("Web MIDI API no soportada en este navegador.");
    }

    connectMQTT((data) => {
      setFingerStatus(data);
      prevFingerStatus.current = data;
    });

    // Centrado inicial del piano en la nota Do4 (do central)
    setTimeout(() => {
      const container = pianoContainerRef.current;
      const do4Key = document.getElementById('do4');
      if (container && do4Key) {
        const containerWidth = container.offsetWidth;
        const keyOffset = do4Key.offsetLeft + (do4Key.offsetWidth / 2);
        container.scrollLeft = keyOffset - containerWidth / 2;
      }
    }, 300);

    // Carga del archivo JSON de notas para el modo canción
    const fileName = `${song}${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}.json`;

    fetch(`/songs/${fileName}`)
      .then(res => res.json())
      .then(data => {
        setLoadedNotes(data);
        console.log('🎵 Datos cargados:', fileName);
      })
      .catch(err => console.error('Error al cargar notas JSON:', err));
  }, [mode, song, difficulty, navigate]);

  // Generador de notas descendentes según el tiempo (modo práctica)
  useEffect(() => {
    if (!practiceStarted || loadedNotes.length === 0) return;

    practiceStartTime.current = Date.now();

    const interval = setInterval(() => {
      // Cuando hay congelamiento global, no agregamos nuevas notas ni avanzamos las que ya están congeladas
      if (globalFreeze) return;

      const now = (Date.now() - practiceStartTime.current) / 1000;
      const upcoming = loadedNotes.filter(n => n.time <= now && !activeNotesRef.current.includes(n));

      if (upcoming.length > 0) {
        setFallingNotes(prev => [...prev, ...upcoming]);
        activeNotesRef.current.push(...upcoming);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [practiceStarted, globalFreeze, loadedNotes]);

  const onMIDISuccess = (midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      console.log("Dispositivo MIDI conectado:", input.name);
      input.onmidimessage = handleMIDIMessage;
    }
  };

  const onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  };

  // Manejo de mensajes MIDI entrantes
  const handleMIDIMessage = ({ data }) => {
    const [status, noteNumber, velocity] = data;
    const NOTE_ON = 144;
    const NOTE_OFF = 128;

    const isNoteOn = status === NOTE_ON && velocity > 0;
    const isNoteOff = status === NOTE_OFF || (status === NOTE_ON && velocity === 0);

    const noteName = MIDI_TO_NOTE[noteNumber];
    if (!noteName) return;

    const scheduleFeedback = () => {
      setTimeout(() => {
        const feedback = {};
        for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
          const pressed = fingerStatus[finger] || false;
          feedback[finger] = {
            pressed,
            color: pressed ? "#00ff00" : "#cccccc",
            freq: pressed ? noteToFreq(noteName) : 0
          };
        }
        if (_.isEqual(feedback, lastPublishedState.current)) return;
        publishFeedback(feedback);
        lastPublishedState.current = feedback;
      }, 80);
    };

    if (isNoteOn) {
      setPressedNotes(prev => [...prev, noteName]);
      playNote(noteName);
      scheduleFeedback();
    }

    if (isNoteOff) {
      setPressedNotes(prev => prev.filter(n => n !== noteName));
      scheduleFeedback();
    }
  };

  // Convierte nombre de nota a una frecuencia aproximada para el motor háptico
  const noteToFreq = (noteName) => {
    const match = noteName.match(/\d+$/);
    if (!match) return 0;

    const pitchIndex = NOTES.indexOf(noteName);
    if (pitchIndex === -1) return 0;

    const ratio = pitchIndex / NOTES.length;
    return Math.round(65500 - (ratio * (65500 - 20000)));
  };

  // Reproduce el audio correspondiente a una nota
  const playNote = (note) => {
    const match = note.match(/^(la|zla|si)(\d)$/);
    let notaCorregida = note;

    if (match) {
      const [, base, octava] = match;
      notaCorregida = `${base}${parseInt(octava) + 1}`;
    }

    const audioElement = document.getElementById(notaCorregida);
    if (!audioElement) {
      console.warn(`No se encontró el archivo de audio para: ${notaCorregida}`);
      return;
    }

    const noteAudio = new Audio(audioElement.src);
    noteAudio.play();
  };

  // Inicia la cuenta regresiva y luego comienza la práctica
  const comenzarPractica = () => {
    setShowCountdown(true);
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(interval);
          setShowCountdown(false);
          setPracticeStarted(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Solo mostrar notas hasta DO6 inclusive
  const VISIBLE_NOTES = NOTES.filter(note => {
    const match = note.match(/\d$/);
    return match && parseInt(match[0]) <= 6;
  });

  const keyWidth = 40;
  const containerHeight = 300;

  return (
    <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh' }}>

      {/* Botón arriba a la derecha */}
      <div className="volver-wrapper">
        <button
          className="volver-btn"
          onClick={() => navigate('/')}
        >
          ⬅ Volver al menú
        </button>
      </div>

      {/* Contenedor principal */}
      <div className="piano-container" ref={pianoContainerRef}>

        {/* Mano en el centro superior */}
        <div className="hand-wrapper">
          <Hand fingerColors={fingerColors} />
        </div>

        {/* MODO CANCIÓN */}

        {/* Botón para iniciar práctica */}
        {mode === 'cancion' && !practiceStarted && !showCountdown && (
          <div className="start-button-wrapper">
            <button className="boton-practica" onClick={comenzarPractica}>
              COMENZAR
            </button>
          </div>
        )}

        {/* Cuenta regresiva */}
        {mode === 'cancion' && showCountdown && (
          <div className="countdown-display">
            {countdown}
          </div>
        )}

        {/* Notas descendentes tipo Synthesia */}
        {mode === 'cancion' && practiceStarted && (
          <div
            className="note-visualizer"
            style={{
              position: 'absolute',
              top: 0,
              height: containerHeight,
              width: '100%',
              pointerEvents: 'none',
              zIndex: 3
            }}
          >
            {fallingNotes.map((n, i) => (
              <FallingNote
                key={i}
                note={n.note}
                time={n.time}
                duration={3}
                keyWidth={keyWidth}
                containerHeight={containerHeight}
                pressedNotes={pressedNotes}
                practiceMode={practiceMode}
                freezeAll={globalFreeze}
                setGlobalFreeze={setGlobalFreeze}
                onEnd={() => {
                  // Al terminar o eliminar una nota, quitarla de la lista y liberar el congelamiento global si corresponde
                  setFallingNotes(prev => {
                    const newNotes = prev.filter((_, index) => index !== i);
                    if (newNotes.length === prev.length - 1) {
                      // Si no hay notas congeladas, liberar globalFreeze
                      // (Se libera cuando no quedan notas o ninguna está congelada)
                      setGlobalFreeze(false);
                    }
                    return newNotes;
                  });
                }}
              />
            ))}
          </div>
        )}

        {/* Línea de impacto visual */}
        {mode === 'cancion' && (
          <div className="impact-line"></div>
        )}
        {/* FIN MODO CANCIÓN */}

        {/* Teclado horizontal */}
        <div className="piano">
          {VISIBLE_NOTES.map((note, index) => (
            <Key
              key={index}
              note={note}
              pressedKeys={pressedNotes}
            />
          ))}
        </div>

        {/* Audios para cada nota */}
        <div>
          {NOTES.map((note, index) => (
            <audio
              id={note}
              key={index}
              src={`/notes/${note}.mp3`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
