// src/components/Piano.js
// ===============================================================
// Componente principal del piano: renderiza teclado, mano, notas
// descendentes, integra MIDI del teclado/DAW y MQTT con el guante.
// ===============================================================

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

  // `mode`: 'cancion' | 'libre'
  // `song`: id de la canción (p.ej. 'ode')
  // `difficulty`: 'facil' | 'normal' | 'dificil'  (compat: 'practica' -> 'normal')
  const { mode = 'cancion', song = 'ode', difficulty = 'normal' } = location.state || {};
  const practiceMode = difficulty;

  // Paleta de colores para visual de dedos y feedback
  const colors = {
    active: "#ffffff",
    perfect: "#00ff00",
    good: "#00ffff",
    miss: "#ff0000",
    idle: "#aaaaaa"
  };

  // ===============================================================
  // Estados React
  // ===============================================================
  const [pressedNotes, setPressedNotes] = useState([]);
  const [fingerColors, setFingerColors] = useState({
    thumb: colors.idle, index: colors.idle, middle: colors.idle, ring: colors.idle, pinky: colors.idle
  });
  const [fingerStatus, setFingerStatus] = useState({
    thumb: false, index: false, middle: false, ring: false, pinky: false
  });
  const [fallingNotes, setFallingNotes] = useState([]);      // lista de {id, note, time}
  const [showCountdown, setShowCountdown] = useState(false); // overlay de 3-2-1
  const [countdown, setCountdown] = useState(3);
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [scoreList, setScoreList] = useState([]);
  const [timingOffsets, setTimingOffsets] = useState([]);

  // Modal de instrucciones al entrar
  const [showInstructions, setShowInstructions] = useState(true);

  // ===============================================================
  // Refs (no causan re-render)
  // ===============================================================
  const prevFingerStatus = useRef({});
  const pianoContainerRef = useRef(null);
  const audioRefs = useRef({});
  const lastNoteRef = useRef(null);

  // Helper para sumar puntaje
  const incrementScore = (total) => setScore(prev => prev + total);

  // ===============================================================
  // Setup inicial: MIDI, MQTT y carga de notas
  // ===============================================================

  // Normalizamos dificultad para el nombre de archivo
  // - 'practica' (legado) => 'normal'
  const fileDifficulty = (() => {
    if (difficulty === 'practica') return 'normal';
    return difficulty;
  })();

  useEffect(() => {
    // Si faltan datos, regresamos a selección
    if (!song || !difficulty) {
      navigate('/practica');
      return;
    }

    // --- MIDI (teclado o DAW) ---
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }

    // --- MQTT (guante) ---
    connectMQTT(data => {
      setFingerStatus(data);
      prevFingerStatus.current = data;
    });

    // --- Centrar el teclado en DO4 (do central) ---
    setTimeout(() => {
      const container = pianoContainerRef.current;
      const do4Key = document.getElementById('do4');
      if (container && do4Key) {
        const offset = do4Key.offsetLeft + (do4Key.offsetWidth / 2);
        container.scrollLeft = offset - container.offsetWidth / 2;
      }
    }, 300);

    // --- Carga de notas desde /public/songs ---
    // Espera archivos con convención: <song><CapDificultad>.json
    // p.ej. odeFacil.json, odeNormal.json, odeDificil.json
    const cap = fileDifficulty.charAt(0).toUpperCase() + fileDifficulty.slice(1);
    const fileName = `${song}${cap}.json`;

    fetch(`/songs/${fileName}`)
      .then(res => res.json())
      .then(data => {
        // Aseguramos un id único por nota para la lista
        const withIds = data.map(n => ({ ...n, id: uuidv4() }));
        setFallingNotes(withIds);
        console.log(`✅ Cargado /songs/${fileName} (${withIds.length} notas)`);
      })
      .catch(err => console.error('Error al cargar notas JSON:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===============================================================
  // Conexión MIDI
  // ===============================================================
  const onMIDISuccess = useCallback((midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }
  }, []);

  const onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  };

  // ===============================================================
  // Audio / Haptics helpers
  // ===============================================================

  // Mapea nombre de nota (p.ej. 'do4') a un duty (0..65535) para vibración
  const noteToFreq = (noteName) => {
    const index = NOTES.indexOf(noteName);
    if (index === -1) return 0;
    const ratio = index / NOTES.length;
    // graves -> duty alto (más fuerte), agudos -> duty menor (más suave)
    return Math.round(65500 - (ratio * (65500 - 20000)));
  };

  // Reproducir audio de la nota (mp3 precargado vía <audio>)
  const playNote = (note) => {
    // Arreglo legacy para audios específicos 'la', 'zla', 'si'
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

  // ===============================================================
  // Actualización visual en modo libre (demostración)
  // ===============================================================
  useEffect(() => {
    if (mode !== 'libre') return;

    // Colorea dedos activos (del guante) en blanco y los inactivos en gris
    setFingerColors(prev => {
      const next = { ...prev };
      for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
        next[f] = (fingerStatus && fingerStatus[f]) ? colors.active : colors.idle;
      }
      return next;
    });
  }, [fingerStatus, mode, colors.active, colors.idle]);

  // ===============================================================
  // Publicación periódica de feedback al guante (MQTT)
  //  - Enviamos el estado de cada dedo con su color actual
  //  - freq depende de la última nota presionada por MIDI
  // ===============================================================
  useEffect(() => {
    const interval = setInterval(() => {
      const feedback = {};
      for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
        const pressed = fingerStatus[finger] || false;
        feedback[finger] = {
          pressed,
          color: fingerColors[finger],
          freq: pressed ? noteToFreq(lastNoteRef.current) : 0
        };
      }
      publishFeedback(feedback);
    }, 75); // 75 ms ~ 13Hz; equilibrio entre latencia y tráfico

    return () => clearInterval(interval);
  }, [fingerColors, fingerStatus]); // reprograma el intervalo si cambian colores/estado

  // ===============================================================
  // Handler MIDI (note on/off)
  // ===============================================================
  const handleMIDIMessage = ({ data }) => {
    const [status, noteNumber, velocity] = data;
    const isNoteOn  = status === 144 && velocity > 0;
    const isNoteOff = status === 128 || (status === 144 && velocity === 0);
    const noteName  = MIDI_TO_NOTE[noteNumber];
    if (!noteName) return;

    if (isNoteOn) {
      setPressedNotes(prev => [...prev, noteName]);
      playNote(noteName);
      lastNoteRef.current = noteName;
    }
    if (isNoteOff) {
      setPressedNotes(prev => prev.filter(n => n !== noteName));
      lastNoteRef.current = null;
    }
  };

  // ===============================================================
  // Cuenta regresiva antes de iniciar práctica
  // ===============================================================
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

  // ===============================================================
  // Render helpers
  // ===============================================================
  // Filtra el teclado visual a octavas útiles (<= 6) para no saturar pantalla
  const VISIBLE_NOTES = NOTES.filter(n => {
    const match = n.match(/\d$/);
    return match && parseInt(match[0]) <= 6;
  });

  const containerHeight = 350;

  // ===============================================================
  // Render
  // ===============================================================
  return (
    <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh' }}>
      {/* Barra superior con botón de regreso y puntaje */}
      <div className="topContainer">
        <div className="volver-wrapper">
          <button className="volver-btn" onClick={() => navigate('/')}>
            Volver al menú
          </button>
        </div>
        <div className="score-wrapper">
          <span className="score-text">Puntaje: {score}</span>
        </div>
      </div>

      {/* Contenedor principal del piano */}
      <div className="piano-container" ref={pianoContainerRef}>

        {/* Mano (solo en modo libre/demo) */}
        {mode === 'libre' && (
          <div className="hand-wrapper">
            <Hand fingerColors={fingerColors} />
          </div>
        )}

        {/* Línea roja de impacto (solo modo canción) */}
        {mode === 'cancion' && <div className="impact-line"></div>}

        {/* Notas descendentes (aparecen cuando inicia la práctica) */}
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
                      // cuando acaban todas, ir a resultados
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

        {/* Teclado visual */}
        <div className="piano">
          {VISIBLE_NOTES.map((note, index) => (
            <Key key={index} note={note} pressedKeys={pressedNotes} />
          ))}
        </div>

        {/* Audios precargados para minimizar latencia al tocar */}
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

      {/* ================= MODAL DE INSTRUCCIONES ================= */}
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

            {mode === 'cancion' ? (
              <>
                <p className="modalP">
                  Las notas descenderán hasta sus teclas. Presiona la tecla cuando la nota toque la
                  <span className="lineaRoja"> línea roja</span> para puntuar mejor.
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

      {/* Overlay simple del conteo 3-2-1 */}
      {showCountdown && (
        <div className="modalOverlay" aria-hidden="true">
          <div className="countdownBubble">{countdown}</div>
        </div>
      )}
    </div>
  );
}

export { Piano };
