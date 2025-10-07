// ===============================================================
// Componente principal del piano: renderiza teclado, mano, notas
// descendentes, integra MIDI del teclado/DAW y MQTT con el guante.
// ===============================================================

import React, { useEffect, useRef, useState } from 'react';
import './Piano.css';
import './FallingNote.css';
import { Key } from './Key.js';
import { Hand } from './Hand.js';
import { FallingNote } from './FallingNote';
import { NOTES } from '../global/constants';
import { connectMQTT } from '../services/MqttClient';
import { useNoteToFreq, usePlayNote } from '../hooks/useAudio.js';
import { useMIDI } from '../hooks/useMIDI.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useMQTTFeedback } from '../hooks/useMQTTFeedback.js';
import { useFingerColors } from '../hooks/useFingerColors.js';
import { useFingerFreqs } from '../hooks/useFingerFreqs.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';


// Paleta de colores para visual de dedos y feedback
const colors = {
  active: "#ffffff",
  perfect: "#00ff00",
  good: "#00ffff",
  miss: "#ff0000",
  idle: "#aaaaaa",
  inactive: "#777777"
};

function Piano() {
  const location = useLocation();
  const navigate = useNavigate();

  // `mode`: 'cancion' | 'libre'
  // `song`: id de la canción (p.ej. 'ode')
  // `difficulty`: 'facil' | 'normal' | 'dificil'  (compat: 'practica' -> 'normal')
  const { mode = 'cancion', song = 'ode', difficulty = 'normal' } = location.state || {};
  const practiceMode = difficulty;

  // ===============================================================
  // Use States
  // ===============================================================
  const [pressedNotes, setPressedNotes] = useState([]);
  const [fingerColors, setFingerColors] = useState({
    thumb: colors.idle, index: colors.idle, middle: colors.idle, ring: colors.idle, pinky: colors.idle
  });
  const [fingerStatus, setFingerStatus] = useState({
    thumb: false, index: false, middle: false, ring: false, pinky: false
  });
  const [fingerFreqs, setFingerFreqs] = useState({
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    pinky: 0,
  });
  const [fallingNotes, setFallingNotes] = useState([]);      // lista de {id, note, time}
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [scoreList, setScoreList] = useState([]);
  const [timingOffsets, setTimingOffsets] = useState([]);
  const [lastScore, setLastScore] = useState(0);
  const [lastNote, setLastNote] = useState(null);
  const [lastActiveFinger, setLastActiveFinger] = useState(null);

  // Modal de instrucciones al entrar
  const [showInstructions, setShowInstructions] = useState(true);

  // ===============================================================
  // Use Refs
  // ===============================================================
  const prevFingerStatus = useRef({});
  const pianoContainerRef = useRef(null);

  // ===============================================================
  // Hooks
  // ===============================================================

  // Hook Audio
  const noteToFreq = useNoteToFreq(NOTES);
  const { playNote, audioRefs } = usePlayNote();

  // Hook MIDI
  useMIDI(
    // onNoteOn callback
    (noteName) => {
      setPressedNotes(prev => [...prev, noteName]);
      playNote(noteName);
      setLastNote(noteName);
    },
    // onNoteOff callback
    (noteName) => {
      setPressedNotes(prev => prev.filter(n => n !== noteName));
      setLastNote(null);
    }
  );

  // Hook Countdown
  const { showCountdown, countdown, startCountdown } = useCountdown(3, () => {
    setPracticeStarted(true);
  });

  // Hook Finger Colors
  useFingerColors(mode, fingerStatus, pressedNotes, lastScore, lastActiveFinger, setFingerColors, colors);



  // Hook MQTT Feedback
  useMQTTFeedback(fingerStatus, fingerColors, fingerFreqs, 70);


  // Hook Finger Frequencies 
  useFingerFreqs(mode, fingerStatus, lastNote, lastActiveFinger, noteToFreq, setFingerFreqs, setLastActiveFinger);

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
        //Rellenamos el arreglo de notas descendentes
        setFallingNotes(withIds);
        console.log(`✅ Cargado /songs/${fileName} (${withIds.length} notas)`);
      })
      .catch(err => console.error('Error al cargar notas JSON:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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
                  setLastScore(inc);
                  if (inc === 0) {
                    setLastActiveFinger(null);
                  }
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