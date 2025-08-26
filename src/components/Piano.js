// src/components/Piano.js
// Componente principal del piano.
// - Se conecta a MQTT (picow/fingers <- del guante | web/pressed -> al guante)
// - Escucha MIDI y publica feedback inmediato (baja latencia).
// - Muestra un pop-up de instrucciones antes de comenzar.
// - Visualiza mano, teclado y (opcionalmente) notas que caen en modo "cancion".

import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Piano.css';
import { Key } from './Key';
import { Hand } from './Hand';
import { NOTES, MIDI_TO_NOTE } from '../global/constants';
import { connectMQTT, publishFeedback, disconnectMQTT } from '../services/MqttClient';
import { FallingNote } from './FallingNote';
import './FallingNote.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

function Piano() {
  // ===== Navegación / modo =====
  const location = useLocation();
  const navigate = useNavigate();
  const { mode = 'cancion', song = 'ode', difficulty = 'practica' } = location.state || {};

  // ===== Estado UI =====
  const [pressedNotes, setPressedNotes] = useState([]);   // notas activas en el teclado renderizado
  const [fingerStatus, setFingerStatus] = useState({      // reporte del guante (MQTT picow/fingers)
    thumb: false, index: false, middle: false, ring: false, pinky: false
  });
  const [fallingNotes, setFallingNotes] = useState([]);   // notas para el modo "cancion"
  const [practiceStarted, setPracticeStarted] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Pop-up de instrucciones: visible al montar (hasta que el usuario lo cierre)
  const [showHowTo, setShowHowTo] = useState(true);

  // Scoring (si tu flujo lo usa)
  const [score, setScore] = useState(0);
  const [scoreList, setScoreList] = useState([]);
  const [timingOffsets, setTimingOffsets] = useState([]);

  // ===== Refs (evitan “stale closures”) =====
  const prevFingerStatus = useRef(fingerStatus);  // último estado de dedos conocido
  const pianoContainerRef = useRef(null);         // para centrar el scroll en do4
  const audioRefs = useRef({});                   // <audio> precargados

  // ===== Efecto de montaje: MQTT, MIDI, centrar, cargar canción =====
  useEffect(() => {
    // 1) Conectar a MQTT (WS) y escuchar estado del guante
    const client = connectMQTT((data) => {
      // data: {thumb:boolean, index:boolean, ...}
      setFingerStatus(data);
      prevFingerStatus.current = data; // mantener ref sincronizada
    });

    // 2) MIDI
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }

    // 3) Centrar el teclado en do4
    setTimeout(() => {
      const container = pianoContainerRef.current;
      const do4Key = document.getElementById('do4');
      if (container && do4Key) {
        const offset = do4Key.offsetLeft + (do4Key.offsetWidth / 2);
        container.scrollLeft = offset - container.offsetWidth / 2;
      }
    }, 300);

    // 4) Cargar canción (solo si usas modo "cancion")
    const fileName = `${song}${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}.json`;
    fetch(`/songs/${fileName}`)
      .then(res => res.json())
      .then(data => setFallingNotes(data.map(n => ({ ...n, id: uuidv4() }))))
      .catch(err => console.error('Error al cargar notas JSON:', err));

    // Limpieza
    return () => {
      disconnectMQTT();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== MIDI =====

  // Registra handler MIDI en todos los inputs
  const onMIDISuccess = useCallback((midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }
  }, []);

  const onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  };

  // Mapeo de nota → duty_u16 (0..65535): graves vibran más, agudas menos
  function noteToDuty(noteName) {
    const idx = NOTES.indexOf(noteName);
    if (idx < 0) return 0;
    const lo = 24000;  // intensidad mínima (agudas)
    const hi = 62000;  // intensidad máxima (graves)
    const t = idx / (NOTES.length - 1);
    return Math.round(hi - (hi - lo) * t); // invertimos para graves=alto duty
  }

  // Reproducir sample local (si lo usas)
  const playNote = (note) => {
    // Corrección de naming si tus audios están desplazados en ciertas notas
    const m = note.match(/^(la|zla|si)(\d)$/);
    let fixed = note;
    if (m) {
      const [, base, octave] = m;
      fixed = `${base}${parseInt(octave) + 1}`;
    }
    const el = audioRefs.current[fixed];
    if (el && el instanceof HTMLAudioElement) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  };

  // Publica feedback inmediato (sin timers) con el ÚLTIMO estado de cada dedo
  const publishImmediateFeedback = (noteName) => {
    const duty = noteToDuty(noteName);
    const fingers = ["thumb", "index", "middle", "ring", "pinky"];
    const last = prevFingerStatus.current;

    // Para cada dedo: si está presionado físicamente, mandamos {pressed:true, color verde, freq=duty}
    // Si no, {pressed:false, color gris, freq:0}. El Pico decide qué hacer (y ya enciende verde local).
    const payload = {};
    for (const f of fingers) {
      const pressed = !!last[f];
      payload[f] = {
        pressed,
        color: pressed ? "#00ff00" : "#cccccc",
        freq:  pressed ? duty : 0
      };
    }
    publishFeedback(payload);
  };

  // Manejo de eventos MIDI
  const handleMIDIMessage = ({ data }) => {
    const [status, noteNumber, velocity] = data;
    const isNoteOn  = status === 144 && velocity > 0;
    const isNoteOff = status === 128 || (status === 144 && velocity === 0);
    const noteName = MIDI_TO_NOTE[noteNumber];
    if (!noteName) return;

    if (isNoteOn) {
      setPressedNotes(prev => [...prev, noteName]); // UI
      playNote(noteName);                           // Audio local
      publishImmediateFeedback(noteName);           // Feedback háptico inmediato
    }
    if (isNoteOff) {
      setPressedNotes(prev => prev.filter(n => n !== noteName));
      publishImmediateFeedback(noteName);           // mantener coherencia (p.ej. apagar duty si aplica)
    }
  };

  // ===== Countdown / inicio =====
  const comenzarPractica = () => {
    setShowCountdown(true);
    setCountdown(3);
    const intv = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(intv);
          setShowCountdown(false);
          setPracticeStarted(true);
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ===== Filtrado de notas visibles en teclado (hasta octava 6) =====
  const VISIBLE_NOTES = NOTES.filter(n => {
    const m = n.match(/\d$/);
    return m && parseInt(m[0], 10) <= 6;
  });

  const containerHeight = 350;

  // ===== Render =====
  return (
    <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh' }}>
      {/* Header superior con navegación y puntaje */}
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

      {/* Contenedor principal */}
      <div className="piano-container" ref={pianoContainerRef}>

        {/* Visual de la mano: dedo activo en verde según fingerStatus */}
        <div className="hand-wrapper">
          <Hand fingerColors={{
            thumb:  fingerStatus.thumb  ? "#00ff00" : "#cccccc",
            index:  fingerStatus.index  ? "#00ff00" : "#cccccc",
            middle: fingerStatus.middle ? "#00ff00" : "#cccccc",
            ring:   fingerStatus.ring   ? "#00ff00" : "#cccccc",
            pinky:  fingerStatus.pinky  ? "#00ff00" : "#cccccc",
          }} />
        </div>

        {/* ===== Pop-up de instrucciones ===== */}
        {showHowTo && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>¿Cómo usar esta práctica?</h2>

              {mode === 'cancion' ? (
                <>
                  <p>
                    Las notas descenderán hasta sus teclas. Presiona la tecla cuando la nota
                    toque la <span style={{ color: '#ff4d4d' }}>línea roja</span>.
                  </p>
                  <ul>
                    <li>Exacto en la línea roja: <strong>100 puntos</strong></li>
                    <li>Cerca de la línea: <strong>50 puntos</strong></li>
                    <li>Muy temprano o muy tarde: <strong>0 puntos</strong></li>
                  </ul>
                  <p>
                    En el guante: cuando el sensor de un dedo detecte presión, verás qué dedo
                    fue y sentirás la vibración correspondiente.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Modo demo: interactúa libremente. El guante marcará qué dedo presionas y
                    vibrará el motor correspondiente (las notas no puntúan).
                  </p>
                </>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button
                  className="modal-primary"
                  onClick={() => setShowHowTo(false)}
                >
                  Entendido
                </button>
                {mode === 'cancion' && !practiceStarted && !showCountdown && (
                  <button
                    className="modal-secondary"
                    onClick={() => { setShowHowTo(false); comenzarPractica(); }}
                  >
                    Entendido y comenzar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Botón de inicio (cuando no hay pop-up) */}
        {mode === 'cancion' && !practiceStarted && !showCountdown && !showHowTo && (
          <div className="start-button-wrapper">
            <button className="boton-practica" onClick={comenzarPractica}>
              COMENZAR
            </button>
          </div>
        )}

        {/* Cuenta regresiva */}
        {mode === 'cancion' && showCountdown && (
          <div className="countdown-display">{countdown}</div>
        )}

        {/* Notas cayendo (solo si ya empezó la práctica) */}
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
                practiceMode={difficulty}
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

        {/* Línea de impacto en modo canción */}
        {mode === 'cancion' && <div className="impact-line"></div>}

        {/* Teclado visual */}
        <div className="piano">
          {VISIBLE_NOTES.map((note, idx) => (
            <Key key={idx} note={note} pressedKeys={pressedNotes} />
          ))}
        </div>

        {/* Audio precargado */}
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