// src/components/Piano.js
// Componente principal del piano. Objetivos:
// - Recibir estado de dedos del guante vía MQTT (picow/fingers).
// - Publicar feedback inmediato al presionar/soltar teclas MIDI (web/pressed):
//     • pressed: true/false por dedo (según fingerStatus recibido del guante)
//     • color:   #00ff00 si presionado, #cccccc si no
//     • freq:    intensidad háptica (duty_u16 0..65535) mapeada por la nota MIDI
//
// Importante de latencia:
// - El encendido de LED y motor en el guante NO depende del round-trip web → Pico;
//   el Pico enciende por el sensor físico de inmediato (verde por defecto).
// - Desde la web solo ajustamos color e intensidad si se desea. Publicamos en el
//   momento del evento MIDI para minimizar cualquier retraso percibido.

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
  const location = useLocation();
  const navigate = useNavigate();
  const { mode = 'cancion', song = 'ode', difficulty = 'practica' } = location.state || {};

  // ======== Estado UI ========

  // Notas actualmente presionadas (para pitar visualmente teclas en el teclado renderizado)
  const [pressedNotes, setPressedNotes] = useState([]);

  // Estado de dedos reportado POR EL GUANTE (MQTT: picow/fingers)
  // true = ese dedo está físicamente presionando su sensor en el guante
  const [fingerStatus, setFingerStatus] = useState({
    thumb: false, index: false, middle: false, ring: false, pinky: false
  });

  // Notas de la canción (para el modo "canción")
  const [fallingNotes, setFallingNotes] = useState([]);

  // Control del flujo de práctica
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [practiceStarted, setPracticeStarted] = useState(false);

  // Puntuación / métricas (si aplican en tu UI)
  const [score, setScore] = useState(0);
  const [scoreList, setScoreList] = useState([]);
  const [timingOffsets, setTimingOffsets] = useState([]);

  // ======== Refs ========

  // Mantiene SIEMPRE el último fingerStatus sin depender del ciclo de render de React
  // (evita “stale closures” dentro de handlers de MIDI)
  const prevFingerStatus = useRef(fingerStatus);

  // Contenedor del teclado para centrar la vista
  const pianoContainerRef = useRef(null);

  // Refs a objetos <audio> precargados para reproducir sonidos
  const audioRefs = useRef({});

  // ======== Efecto de montaje: conecta MQTT, MIDI y carga canción ========

  useEffect(() => {
    // 1) Conexión a MQTT: suscribirse a 'picow/fingers'
    const client = connectMQTT((data) => {
      // data = {thumb:bool, index:bool, ...} publicado por el Pico
      setFingerStatus(data);
      prevFingerStatus.current = data; // actualizar ref inmediatamente
    });

    // 2) Acceso a MIDI
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    }

    // 3) Centrar el piano en do4 (opcional, visual)
    setTimeout(() => {
      const container = pianoContainerRef.current;
      const do4Key = document.getElementById('do4');
      if (container && do4Key) {
        const offset = do4Key.offsetLeft + (do4Key.offsetWidth / 2);
        container.scrollLeft = offset - container.offsetWidth / 2;
      }
    }, 300);

    // 4) Cargar la canción en JSON (si aplica en tu flujo)
    const fileName = `${song}${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}.json`;
    fetch(`/songs/${fileName}`)
      .then(res => res.json())
      .then(data => setFallingNotes(data.map(n => ({ ...n, id: uuidv4() }))))
      .catch(err => console.error('Error al cargar notas JSON:', err));

    // Limpieza al desmontar
    return () => {
      disconnectMQTT();
    };
  }, []); // solo 1 vez

  // ======== MIDI ========

  // Al tener acceso, registramos handler de mensajes MIDI
  const onMIDISuccess = useCallback((midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
    }
  }, []);

  const onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  };

  // Mapea el nombre de la nota a un duty_u16 0..65535:
  // graves → duty alto (vibran más), agudos → duty bajo (vibran menos)
  const noteToDuty = (noteName) => {
    const idx = NOTES.indexOf(noteName);
    if (idx === -1) return 0;
    const ratio = idx / NOTES.length;
    // 20k..65.5k aprox (ajusta si quieres más/menos rango de vibración)
    return Math.round(65500 - (ratio * (65500 - 20000)));
  };

  // Reproduce audio local de la nota (si tu UI lo requiere)
  const playNote = (note) => {
    // Corrige algunas notas que en tu set de samples están desplazadas
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

  // Publica feedback inmediato al broker usando EL ÚLTIMO estado de dedos
  // proveniente del guante (prevFingerStatus.current).
  // Esto garantiza que el dedo que físicamente está presionando reciba el estímulo correcto.
  const publishImmediateFeedback = (noteName) => {
    const fingers = ["thumb", "index", "middle", "ring", "pinky"];
    const duty = noteToDuty(noteName);

    // Construimos el payload por dedo:
    // - pressed: lo que reporta el guante (no lo inferimos por MIDI)
    // - color:   verde si presionado, gris si no (puedes cambiarlo a gusto)
    // - freq:    intensidad háptica (duty) si está presionado; 0 si no
    const last = prevFingerStatus.current;
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

  // Handler principal de eventos MIDI (note on/off)
  const handleMIDIMessage = ({ data }) => {
    // data = [status, noteNumber, velocity]
    const [status, noteNumber, velocity] = data;

    // Note on si status=144 y velocity>0 | Note off si 128 o velocity=0 en 144
    const isNoteOn  = status === 144 && velocity > 0;
    const isNoteOff = status === 128 || (status === 144 && velocity === 0);

    // Pasar número MIDI a nombre (usa tu mapa)
    const noteName = MIDI_TO_NOTE[noteNumber];
    if (!noteName) return;

    if (isNoteOn) {
      // 1) UI: marcar nota como presionada
      setPressedNotes(prev => [...prev, noteName]);

      // 2) Audio local (si corresponde)
      playNote(noteName);

      // 3) Publicar feedback de inmediato (sin timers, sin esperas)
      publishImmediateFeedback(noteName);
    }

    if (isNoteOff) {
      // 1) UI: quitar nota de presionadas
      setPressedNotes(prev => prev.filter(n => n !== noteName));

      // 2) También notificamos (mantiene coherencia de color/freq si quieres apagados explícitos)
      publishImmediateFeedback(noteName);
    }
  };

  // ======== Lógica de práctica (UI) ========

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

  // Solo mostramos hasta la octava 6 en el teclado (ajústalo si necesitas más)
  const VISIBLE_NOTES = NOTES.filter(n => {
    const m = n.match(/\d$/);
    return m && parseInt(m[0]) <= 6;
  });

  const containerHeight = 350;

  // ======== Render ========

  return (
    <div style={{ backgroundColor: '#2b2d31', minHeight: '100vh' }}>
      <div className="topContainer">
        <div className="volver-wrapper">
          <button className="volver-btn" onClick={() => navigate('/')}>
            ⬅ Volver al menú
          </button>
        </div>
        <div className="score-wrapper">
          <span className="score-text">Puntaje:{score} </span>
        </div>
      </div>

      <div className="piano-container" ref={pianoContainerRef}>
        {/* Mano: aquí puedes visualizar dedo activo en verde según fingerStatus */}
        <div className="hand-wrapper">
          <Hand fingerColors={{
            thumb:  fingerStatus.thumb  ? "#00ff00" : "#cccccc",
            index:  fingerStatus.index  ? "#00ff00" : "#cccccc",
            middle: fingerStatus.middle ? "#00ff00" : "#cccccc",
            ring:   fingerStatus.ring   ? "#00ff00" : "#cccccc",
            pinky:  fingerStatus.pinky  ? "#00ff00" : "#cccccc",
          }} />
        </div>

        {/* Botón de inicio para modo canción */}
        {mode === 'cancion' && !practiceStarted && !showCountdown && (
          <div className="start-button-wrapper">
            <button className="boton-practica" onClick={comenzarPractica}>COMENZAR</button>
          </div>
        )}

        {mode === 'cancion' && showCountdown && (
          <div className="countdown-display">{countdown}</div>
        )}

        {/* Visualizador de notas cayendo */}
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

        {mode === 'cancion' && <div className="impact-line"></div>}

        {/* Teclado físico en pantalla */}
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

export { Piano }
