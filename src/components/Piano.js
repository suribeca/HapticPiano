// ===============================================================
// Componente principal del piano: renderiza teclado, mano, notas
// descendentes, integra MIDI del teclado/DAW y MQTT con el guante.
// 
// ===============================================================

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import './Piano.css';
import './FallingNote.css';
import { Key } from './Key.js';
import { Hand } from './Hand.js';
import { FallingNote } from './FallingNote';
import { NOTES, COLORS } from '../global/constants';
import { connectMQTT, disconnectMQTT } from '../services/MqttClient';
import { useNoteToFreq, usePlayNote } from '../hooks/useAudio.js';
import { useMIDI } from '../hooks/useMIDI.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { useMQTTFeedback } from '../hooks/useMQTTFeedback.js';
import { useFingerColors } from '../hooks/useFingerColors.js';
import { useFingerFreqs } from '../hooks/useFingerFreqs.js';
import { useSongLoader } from '../hooks/useSongLoader.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { useScoreFace } from '../hooks/useScoreFace.js';

import { useLatencyMeasurement } from '../hooks/useLatencyMeasurement.js';
import { useFingerColorsTiming } from '../hooks/useFingerColorsTiming.js';


/**
 * Componente principal del piano interactivo
 * @component
 */
function Piano() {
  const location = useLocation();
  const navigate = useNavigate();

  const { mode = 'cancion', song = 'ode', songTitle = null, difficulty = 'normal' } = location.state || {};
  const practiceMode = difficulty;
  const colors = useMemo(() => COLORS, []);

  // ===============================================================
  // STATES
  // ===============================================================
  const [pressedNotes, setPressedNotes] = useState([]);
  const [fingerColors, setFingerColors] = useState({
    thumb: colors.idle, index: colors.idle, middle: colors.idle, ring: colors.idle, pinky: colors.idle
  });
  const fingerStatusRef = useRef({
    thumb: false, index: false, middle: false, ring: false, pinky: false
  });

  const [fingerStatusDisplay, setFingerStatusDisplay] = useState({
    thumb: false, index: false, middle: false, ring: false, pinky: false
  });

  const [fingerFreqs, setFingerFreqs] = useState({
    thumb: 0,
    index: 0,
    middle: 0,
    ring: 0,
    pinky: 0,
  });
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [scoreList, setScoreList] = useState([]);
  const [timingOffsets, setTimingOffsets] = useState([]);
  const [lastScore, setLastScore] = useState(0);
  const [lastNote, setLastNote] = useState(null);
  const [lastActiveFinger, setLastActiveFinger] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);

  // ===============================================================
  // REFS
  // ===============================================================
  const pianoContainerRef = useRef(null);

  // ===============================================================
  // HOOKS
  // ===============================================================
  const noteToFreq = useNoteToFreq(NOTES);
  const { playNote, audioRefs } = usePlayNote();

  // --- memoized MIDI callbacks: IMPORTANT to avoid multiple attachments ---
  const handleNoteOn = useCallback((noteName) => {
    // start profiler here in useMIDI (already implemented there)
    setPressedNotes(prev => {
      // avoid duplicates if same note is already present
      if (prev.includes(noteName)) return prev;
      return [...prev, noteName];
    });
    // play note (assume playNote is stable from hook)
    try { playNote(noteName); } catch (e) { /* noop */ }
    setLastNote(noteName);
  }, [playNote, setLastNote, setPressedNotes]);

  const handleNoteOff = useCallback((noteName) => {
    setPressedNotes(prev => prev.filter(n => n !== noteName));
    setLastNote(null);
  }, [setPressedNotes, setLastNote]);

  useMIDI(handleNoteOn, handleNoteOff);

  const { showCountdown, countdown, startCountdown } = useCountdown(3, () => {
    setPracticeStarted(true);
  });

  // useFingerColors (passes .current for status to avoid re-renders)
  useFingerColors(mode, fingerStatusRef.current, pressedNotes, lastScore, lastActiveFinger, setFingerColors, colors);

  useMQTTFeedback(fingerStatusRef.current, fingerColors, fingerFreqs, 60);

  useFingerFreqs(mode, fingerStatusRef.current, lastNote, lastActiveFinger, noteToFreq, setFingerFreqs, setLastActiveFinger);

  const { fallingNotes, setFallingNotes, loading, error } = useSongLoader(song, difficulty, navigate);

  const face = useScoreFace(mode, lastScore, colors);
  // Hook Latency Measurement
  //useLatencyMeasurement(pressedNotes, fingerStatusRef);

  // ===============================================================
  // COMPONENTE: Carita de puntaje (SVG)
  // ===============================================================
  function ScoreFaceSVG({ mood, color }) {
    const size = 64;
    const cx = size / 2;
    const cy = size / 2;
    const eyeOffsetX = 14;
    const eyeOffsetY = 10;

    // Boca según estado (la inicial es línea horizontal: 'neutral')
    const mouthProps = (() => {
      if (mood === 'happyOpen') {
        return { type: 'open' }; // dibujamos con <ellipse/>
      }
      if (mood === 'happy') {
        return { type: 'path', d: `M ${cx - 16} ${cy + 8} Q ${cx} ${cy + 22} ${cx + 16} ${cy + 8}` };
      }
      if (mood === 'sad') {
        return { type: 'path', d: `M ${cx - 16} ${cy + 16} Q ${cx} ${cy + 2} ${cx + 16} ${cy + 16}` };
      }
      // neutral (línea horizontal)
      return { type: 'path', d: `M ${cx - 12} ${cy + 12} L ${cx + 12} ${cy + 12}` };
    })();

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="score-face">
        {/* Contorno de cara */}
        <circle cx={cx} cy={cy} r={30} fill="none" stroke={color} strokeWidth="3" />
        {/* Ojos */}
        <circle cx={cx - eyeOffsetX} cy={cy - eyeOffsetY} r={3} fill={color} />
        <circle cx={cx + eyeOffsetX} cy={cy - eyeOffsetY} r={3} fill={color} />
        {/* Boca */}
        {mouthProps.type === 'open' ? (
          <ellipse cx={cx} cy={cy + 14} rx="10" ry="7" fill={color} />
        ) : (
          <path d={mouthProps.d} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
      </svg>
    );
  }

  //================================================================
  // EFFECTS
  //================================================================ 

  const handleMqttMessage = useCallback((data) => {
    const now = Date.now();
    const picoTimestamp = data.timestamp;
    if (picoTimestamp) {
      const networkLatency = now - picoTimestamp;
      console.log(`[MQTT] Latencia red (Pico→React): ${networkLatency}ms`);
    }

    const newStatus = {
      thumb: !!data.thumb,
      index: !!data.index,
      middle: !!data.middle,
      ring: !!data.ring,
      pinky: !!data.pinky
    };

    // Actualización directa del ref (rápido, sin re-render)
    fingerStatusRef.current = newStatus;

    // Actualizar estado de display SOLO si cambió (reduce renders)
    setFingerStatusDisplay(prev => {
      const changed = (
        prev.thumb !== newStatus.thumb ||
        prev.index !== newStatus.index ||
        prev.middle !== newStatus.middle ||
        prev.ring !== newStatus.ring ||
        prev.pinky !== newStatus.pinky
      );
      return changed ? newStatus : prev;
    });
  }, []);

  useEffect(() => {
    const c = connectMQTT(handleMqttMessage);

    return () => {
      // cleanup: desconectar cliente MQTT cuando el componente se desmonte
      try { disconnectMQTT(true); } catch (e) { /* noop */ }
    };
  }, [handleMqttMessage]);

  // ===============================================================
  // RENDER HELPERS
  // ===============================================================

  // Centrar teclado en DO4 al montar componente
  useEffect(() => {
    const t = setTimeout(() => {
      const container = pianoContainerRef.current;
      const do4Key = document.getElementById('do4');
      if (container && do4Key) {
        const offset = do4Key.offsetLeft + (do4Key.offsetWidth / 2);
        container.scrollLeft = offset - container.offsetWidth / 2;
      }
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const VISIBLE_NOTES = useMemo(() =>
    NOTES.filter(n => {
      const match = n.match(/\d$/);
      return match && parseInt(match[0]) <= 6;
    }),
    []
  );



  ///////



  const containerHeight = 350;

  // ===============================================================
  // RENDER
  // ===============================================================
  console.log("RENDER PIANO");
  // Estado de carga
  if (loading) {
    return (
      <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', fontSize: '24px' }}>Cargando canción...</div>
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#ff0000', fontSize: '24px' }}>Error: {error}</div>
      </div>
    );
  }

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

        {/* === Carita de feedback (solo en modo práctica/canción) === */}
        {mode === 'cancion' && (
          <div className="score-face-container">
            <div className="score-face">
              <ScoreFaceSVG mood={face.mood} color={face.color} />
            </div>
          </div>
        )}

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
                          state: { score, timingOffsets, scores: scoreList, songName: songTitle || song, difficulty }
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