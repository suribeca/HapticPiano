// Importación de librerías necesarias y archivos del proyecto
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Piano.css'; // Estilos para el componente Piano
import { Key } from './Key.js'; // Representación visual de cada tecla
import { Hand } from './Hand.js'; // Visualización de la mano
import { NOTES, MIDI_TO_NOTE } from '../global/constants'; // Notas y mapeo MIDI
import { connectMQTT, publishFeedback } from '../services/MqttClient'; // Comunicación MQTT
import { FallingNote } from './FallingNote'; // Notas animadas visualmente
import './FallingNote.css'; // Estilos para notas que caen
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid'; // Para generar IDs únicos
import _ from 'lodash';

function Piano() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode = 'cancion', song = 'ode', difficulty = 'practica' } = location.state || {};

  // Estados del componente
  const [pressedNotes, setPressedNotes] = useState([]);
  const [fingerColors, setFingerColors] = useState({
    thumb: "#cccccc", index: "#cccccc", middle: "#cccccc", ring: "#cccccc", pinky: "#cccccc"
  });
  const [fingerStatus, setFingerStatus] = useState({});
  const [fallingNotes, setFallingNotes] = useState([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [score, setScore] = useState(0);

  const practiceMode = difficulty;
  const prevFingerStatus = useRef({});
  const lastPublishedState = useRef({});
  const pianoContainerRef = useRef(null);
  const audioRefs = useRef({}); // Refs para reproducir audio precargado
  const incrementScore = (total) => setScore(prev => prev + total);


  // Al montar: configurar MIDI, MQTT y notas
  useEffect(() => {
    if (!song || !difficulty) {
      navigate('/practica');
      return;
    }

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }

    connectMQTT(data => {
      setFingerStatus(data);
      prevFingerStatus.current = data;
    });

    // Centrar en do4 al cargar
    setTimeout(() => {
      const container = pianoContainerRef.current;
      const do4Key = document.getElementById('do4');
      if (container && do4Key) {
        const offset = do4Key.offsetLeft + (do4Key.offsetWidth / 2);
        container.scrollLeft = offset - container.offsetWidth / 2;
      }
    }, 300);

    // Cargar archivo JSON de la canción seleccionada
    const fileName = `${song}${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}.json`;
    fetch(`/songs/${fileName}`)
      .then(res => res.json())
      .then(data => {
        const withIds = data.map(note => ({ ...note, id: uuidv4() }));
        setFallingNotes(withIds);
      })
      .catch(err => console.error('Error al cargar notas JSON:', err));
  }, []);

  // Conexión MIDI
  const onMIDISuccess = useCallback((midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }
  }, []);

  const onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  };

  // Manejo de eventos MIDI (teclas presionadas/liberadas)
  const handleMIDIMessage = ({ data }) => {
    const [status, noteNumber, velocity] = data;
    const isNoteOn = status === 144 && velocity > 0;
    const isNoteOff = status === 128 || (status === 144 && velocity === 0);

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
        if (!_.isEqual(feedback, lastPublishedState.current)) {
          publishFeedback(feedback);
          lastPublishedState.current = feedback;
        }
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

  // Frecuencia háptica por nota
  const noteToFreq = (noteName) => {
    const index = NOTES.indexOf(noteName);
    if (index === -1) return 0;
    const ratio = index / NOTES.length;
    return Math.round(65500 - (ratio * (65500 - 20000)));
  };

  // Reproducir nota desde HTMLAudioElement
  const playNote = (note) => {
    const match = note.match(/^(la|zla|si)(\d)$/);
    let correctedNote = note;
    if (match) {
      const [, base, octave] = match;
      correctedNote = `${base}${parseInt(octave) + 1}`;
    }

    const audio = audioRefs.current[correctedNote];
    if (audio && audio instanceof HTMLAudioElement) {
      audio.currentTime = 0;
      audio.play().catch(err =>
        console.warn(`Error al reproducir audio:`, err)
      );
    }
  };

  // Cuenta regresiva antes de comenzar
  const comenzarPractica = () => {
    setShowCountdown(true);
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(interval);
          setShowCountdown(false);
          setPracticeStarted(true);
        }
        return prev - 1;
      });
    }, 1000);
  };

  const VISIBLE_NOTES = NOTES.filter(n => {
    const match = n.match(/\d$/);
    return match && parseInt(match[0]) <= 6;
  });

  const keyWidth = 40;
  const containerHeight = 350;

  return (
    <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh' }}>

      <div className="topContainer">
        {/* Botón de regreso */}
        <div className="volver-wrapper">
          <button className="volver-btn" onClick={() => navigate('/')}>
            ⬅ Volver al menú
          </button>
        </div>
        <div className="score-wrapper">
          <span className="score-text">Puntaje:{score} </span>
        </div>
      </div>
      {/* Contenedor del piano */}
      <div className="piano-container" ref={pianoContainerRef}>

        {/* Mano visual */}
        <div className="hand-wrapper">
          <Hand fingerColors={fingerColors} />
        </div>

        {/* Inicio del modo canción */}
        {mode === 'cancion' && !practiceStarted && !showCountdown && (
          <div className="start-button-wrapper">
            <button className="boton-practica" onClick={comenzarPractica}>
              COMENZAR
            </button>
          </div>
        )}

        {/* Cuenta regresiva visual */}
        {mode === 'cancion' && showCountdown && (
          <div className="countdown-display">{countdown}</div>
        )}

        {/* Notas animadas descendentes */}
        {mode === 'cancion' && practiceStarted && (
          <div className="note-visualizer" style={{
            position: 'absolute',
            top: 0,
            height: containerHeight,
            width: '100%',
            pointerEvents: 'none',
            zIndex: 3
          }}>
            {fallingNotes.map((n) => (
              <FallingNote
                key={n.id}
                id={n.id}
                note={n.note}
                time={n.time}
                duration={3}
                containerHeight={containerHeight}
                pressedNotes={pressedNotes}
                practiceMode={practiceMode}
                onScore={incrementScore}
                onEnd={(id) => {
                  setFallingNotes(prev => prev.filter(note => note.id !== id));
                }}
              />
            ))}
          </div>
        )}

        <div
          className="note-visualizer"
          style={{
            position: 'absolute',
            top: 0,
            height: containerHeight,
            width: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
            zIndex: 3
          }}
        ></div>

        {/* Línea de impacto */}
        {mode === 'cancion' && (
          <div className="impact-line"></div>
        )}

        {/* Teclado */}
        <div className="piano">
          {VISIBLE_NOTES.map((note, index) => (
            <Key key={index} note={note} pressedKeys={pressedNotes} />
          ))}
        </div>

        {/* Audio precargado para todas las notas */}
        <div style={{ display: "none" }}>
          {NOTES.map((note, i) => (
            <audio
              key={i}
              id={`audio-${note}`}
              src={`../../notes/${note}.mp3`}
              ref={el => (audioRefs.current[note] = el)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export { Piano };
