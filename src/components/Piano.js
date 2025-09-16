// src/components/Piano.js
import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Piano.css';
import { Key } from './Key.js';
import { Hand } from './Hand.js';
import { NOTES, MIDI_TO_NOTE } from '../global/constants';
import { connectMQTT, publishFeedback } from '../services/MqttClient';
import { FallingNote } from './FallingNote';
import './FallingNote.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';

function Piano() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mode = 'cancion', song = 'ode', difficulty = 'practica' } = location.state || {};

  // ------------------ Estado UI ------------------
  const [pressedNotes, setPressedNotes] = useState([]);
  const [fingerColors] = useState({
    thumb: "#cccccc", index: "#cccccc", middle: "#cccccc", ring: "#cccccc", pinky: "#cccccc"
  });
  const [fingerStatus, setFingerStatus] = useState({
    thumb: false, index: false, middle: false, ring: false, pinky: false
  });
  const [fallingNotes, setFallingNotes] = useState([]);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [scoreList, setScoreList] = useState([]);
  const [timingOffsets, setTimingOffsets] = useState([]);

  // Modal: visible al cargar. Se cierra sólo cuando la persona pulsa “Entendido”
  const [showInstructions, setShowInstructions] = useState(true);

  // ------------------ Refs ------------------
  const practiceMode = difficulty;
  const prevFingerStatus = useRef({});
  const lastPublishedState = useRef({});
  const pianoContainerRef = useRef(null);
  const audioRefs = useRef({});
  const incrementScore = (total) => setScore(prev => prev + total);

  // ------------------ Mount: MIDI, MQTT, Canción, Scroll inicial ------------------
  useEffect(() => {
    if (!song || !difficulty) {
      navigate('/practica');
      return;
    }

    // MIDI
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }

    // MQTT
    connectMQTT(data => {
      setFingerStatus(data);
      prevFingerStatus.current = data;
    });

    // Centrar en DO4 tras montar
    setTimeout(() => {
      const container = pianoContainerRef.current;
      const do4 = document.getElementById('do4');
      if (container && do4) {
        const offset = do4.offsetLeft + (do4.offsetWidth / 2);
        container.scrollLeft = offset - container.offsetWidth / 2;
      }
    }, 300);

    // Cargar notas de la canción seleccionada
    const fileName = `${song}${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}.json`;
    fetch(`/songs/${fileName}`)
      .then(res => res.json())
      .then(data => {
        const withIds = data.map(note => ({ ...note, id: uuidv4() }));
        setFallingNotes(withIds);
      })
      .catch(err => console.error('Error al cargar notas JSON:', err));
  }, []); // eslint-disable-line

  // ------------------ MIDI ------------------
  const onMIDISuccess = useCallback((midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }
  }, []);

  const onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  };

  // Nota MIDI -> frecuencia/intensidad háptica (map simple grave→fuerte, agudo→suave)
  const noteToFreq = (noteName) => {
    const index = NOTES.indexOf(noteName);
    if (index === -1) return 0;
    const ratio = index / NOTES.length;
    // 20000..65500 (lineal). Si prefieres desactivar variación, fija un valor (p.ej. 45000)
    return Math.round(65500 - (ratio * (65500 - 20000)));
  };

  // Reproducir audio HTML precargado
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
      audio.play().catch(() => {});
    }
  };

  // Publica a MQTT el estado actual de dedos tras cada NoteOn/NoteOff
  const publishImmediateFeedback = (noteName) => {
    const feedback = {};
    for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
      const pressed = prevFingerStatus.current[finger] || false;
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
  };

  // MIDI handler
  const handleMIDIMessage = ({ data }) => {
    const [status, noteNumber, velocity] = data;
    const isNoteOn = status === 144 && velocity > 0;
    const isNoteOff = status === 128 || (status === 144 && velocity === 0);
    const noteName = MIDI_TO_NOTE[noteNumber];
    if (!noteName) return;

    if (isNoteOn) {
      setPressedNotes(prev => [...prev, noteName]);
      playNote(noteName);
      publishImmediateFeedback(noteName);
    }
    if (isNoteOff) {
      setPressedNotes(prev => prev.filter(n => n !== noteName));
      publishImmediateFeedback(noteName);
    }
  };

  // ------------------ Countdown ------------------
  const startCountdown = () => {
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

  // ------------------ Render ------------------
  const VISIBLE_NOTES = NOTES.filter(n => {
    const match = n.match(/\d$/);
    return match && parseInt(match[0]) <= 6;
  });

  const containerHeight = 350;

  return (
    <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh' }}>
      {/* Top bar con puntaje */}
      <div className="topContainer">
        <div className="volver-wrapper">
          <button className="volver-btn" onClick={() => navigate('/')}>
            ⬅ Volver al menú
          </button>
        </div>
        <div className="score-wrapper">
          <span className="score-text">Puntaje: {score}</span>
        </div>
      </div>

      <div className="piano-container" ref={pianoContainerRef}>
        {/* Mano visual */}
        <div className="hand-wrapper">
          <Hand fingerColors={fingerColors} />
        </div>

        {/* Línea de impacto (solo modo canción) */}
        {mode === 'cancion' && <div className="impact-line"></div>}

        {/* Notas descendentes (cuando inicia la práctica) */}
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
                onScore={(inc, offsetMs) => {
                  setScore(prev => prev + inc);
                  setScoreList(prev => [...prev, inc]);
                  setTimingOffsets(prev => [...prev, offsetMs]);
                }}
                onEnd={(id) => {
                  setFallingNotes(prev => {
                    const updated = prev.filter(note => note.id !== id);
                    if (updated.length === 0) {
                      setTimeout(() => {
                        navigate('/results', {
                          state: { score, timingOffsets, scores: scoreList }
                        });
                      }, 1500);
                    }
                    return updated;
                  });
                }}
              />
            ))}
          </div>
        )}

        {/* Teclado */}
        <div className="piano">
          {VISIBLE_NOTES.map((note, index) => (
            <Key key={index} note={note} pressedKeys={pressedNotes} />
          ))}
        </div>

        {/* Audios precargados */}
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

      {/* ------------------ MODAL DE INSTRUCCIONES ------------------ */}
      {showInstructions && (
        <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="howto-title">
          <div className="modalCard">
            <button
              className="modalClose"
              aria-label="Cerrar"
              onClick={() => setShowInstructions(false)}
            >
              ×
            </button>

            <h2 id="howto-title" className="modalTitle">¿Cómo usar esta práctica?</h2>

            {/* Texto distinto según el modo */}
            {mode === 'cancion' ? (
              <>
                <p className="modalP">
                  Las notas descenderán hasta sus teclas. Presiona la tecla cuando la nota toque la
                  <span className="lineaRoja"> línea roja</span> y se prenda de color <span className="notaVerde">verde</span>.
                </p>
                <ul className="modalList">
                  <li>Exacto en la línea roja: <strong>100 puntos</strong></li>
                  <li>Cerca de la línea: <strong>50 puntos</strong></li>
                  <li>Muy temprano o muy tarde: <strong>0 puntos</strong></li>
                </ul>
                <p className="modalP">
                  En el guante: cuando el sensor detecte presión, verás qué dedo fue y sentirás la vibración correspondiente.
                </p>
                <div className="modalActions">
                  <button
                    className="btnPrimary"
                    onClick={() => {
                      setShowInstructions(false);
                      startCountdown();
                    }}
                  >
                    Entendido y comenzar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="modalP">
                  <strong>Modo demo:</strong> interactúa libremente. El guante marcará qué dedo presionas
                  y vibrará el motor correspondiente (no hay puntuación).
                </p>
                <div className="modalActions">
                  <button className="btnPrimary" onClick={() => setShowInstructions(false)}>
                    Entendido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cuenta regresiva (overlay simple) */}
      {showCountdown && (
        <div className="modalOverlay" aria-hidden="true">
          <div className="countdownBubble">{countdown}</div>
        </div>
      )}
    </div>
  );
}

export { Piano };
