// Importación de librerías necesarias y archivos del proyecto
import _ from 'lodash';
import React from 'react';
import './Piano.css'; // Estilos específicos para el componente Piano
import { Key } from './Key.js'; // Componente visual de cada tecla
import { Hand } from './Hand.js'; // Componente visual de la mano
import {
  NOTES,        // Lista completa de notas ('do3', 'zsol4', etc.)
  MIDI_TO_NOTE, // Mapeo número MIDI → nota legible
} from '../global/constants';
import { connectMQTT, publishFeedback } from '../services/MqttClient'; // Conexión a broker MQTT para intercambio de mensajes
import { FallingNote } from './FallingNote'; // Notas que caen visualmente
import './FallingNote.css'; // Estilos para las notas que caen

// Componente principal del piano
class Piano extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pressedNotes: [],
      fingerColors: {
        thumb: "#cccccc",
        index: "#cccccc",
        middle: "#cccccc",
        ring: "#cccccc",
        pinky: "#cccccc"
      },
      fingerStatus: {},
      fallingNotes: [], // Notas a visualizar como animación descendente
      showCountdown: false, // Controla si se muestra la cuenta regresiva
      countdown: 3,         // Número actual de la cuenta regresiva
      practiceStarted: false // Controla si ya inició la práctica
    };

    this.pianoContainerRef = React.createRef(); // Referencia para centrar visualmente en do4 al cargar
    this.prevFingerStatus = {}; // Estado de los dedos recibido de la Raspberry
    this.lastPublished = {};
  }

  // Se ejecuta cuando el componente se monta
  componentDidMount() {
    // Conecta al dispositivo MIDI si está disponible
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(this.onMIDISuccess, this.onMIDIFailure);
    } else {
      console.warn("Web MIDI API no soportada en este navegador.");
    }

    // Conexión MQTT
    connectMQTT((data) => {
      this.setState({ fingerStatus: data });
      this.prevFingerStatus = this.state.fingerStatus;
    });

    // Centra visualmente el piano en la tecla do4 (do central)
    setTimeout(() => {
      const container = this.pianoContainerRef.current;
      const do4Key = document.getElementById('do4');
      if (container && do4Key) {
        const containerWidth = container.offsetWidth;
        const keyOffset = do4Key.offsetLeft + (do4Key.offsetWidth / 2);
        container.scrollLeft = keyOffset - containerWidth / 2;
      }
    }, 300);

    // Carga las notas desde un archivo JSON para visualización tipo Synthesia
    fetch('/notes/odeDifficult.json')
      .then(res => res.json())
      .then(data => this.setState({ fallingNotes: data }))
      .catch(err => console.error('Error al cargar notas JSON:', err));
  }

  // Conexión exitosa a un dispositivo MIDI
  onMIDISuccess = (midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      console.log("Dispositivo MIDI conectado:", input.name);
      input.onmidimessage = this.handleMIDIMessage;
    }
  };

  // Fallo al conectar a MIDI
  onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  }

  // Maneja cada mensaje MIDI recibido
  handleMIDIMessage = ({ data }) => {
    const [status, noteNumber, velocity] = data;
    const NOTE_ON = 144;
    const NOTE_OFF = 128;

    const isNoteOn = status === NOTE_ON && velocity > 0;
    const isNoteOff = status === NOTE_OFF || (status === NOTE_ON && velocity === 0);

    const noteName = MIDI_TO_NOTE[noteNumber];
    if (!noteName) return;

    const prevPressedNotes = this.state.pressedNotes;

    const scheduleFeedback = () => {
      setTimeout(() => {
        const currentFingers = this.state.fingerStatus || {};
        const feedback = {};

        for (const finger of ["thumb", "index", "middle", "ring", "pinky"]) {
          const pressed = currentFingers[finger] || false;
          feedback[finger] = {
            pressed,
            color: pressed ? "#00ff00" : "#cccccc",
            freq: pressed ? this.noteToFreq(noteName) : 0
          };
        }

        if (_.isEqual(feedback, this.lastPublishedState)) return;
        publishFeedback(feedback);
        this.lastPublishedState = feedback;
      }, 80);
    };

    if (isNoteOn) {
      this.setState({ pressedNotes: [...prevPressedNotes, noteName] });
      this.playNote(noteName);
      scheduleFeedback();
    }

    if (isNoteOff) {
      this.setState({
        pressedNotes: prevPressedNotes.filter(n => n !== noteName)
      });
      scheduleFeedback();
    }
  };

  // Convierte nombre de nota a frecuencia estimada
  noteToFreq = (noteName) => {
    const match = noteName.match(/\d+$/);
    if (!match) return 0;

    const pitchIndex = NOTES.indexOf(noteName);
    if (pitchIndex === -1) return 0;

    const ratio = pitchIndex / NOTES.length;
    return Math.round(65500 - (ratio * (65500 - 20000)));
  };

  // Reproduce el archivo de audio correspondiente a la nota
  playNote = (note) => {
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

  // Inicia la cuenta regresiva y luego activa la práctica
  comenzarPractica = () => {
    this.setState({ showCountdown: true, countdown: 3 });
    const interval = setInterval(() => {
      this.setState(prev => {
        if (prev.countdown === 1) {
          clearInterval(interval);
          return { showCountdown: false, practiceStarted: true };
        }
        return { countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  render() {
    const { pressedNotes, fingerColors, fallingNotes, showCountdown, countdown, practiceStarted } = this.state;

    // Solo mostrar hasta DO6 inclusive
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
            onClick={() => window.location.href = '/'}
          >
            ⬅ Volver al inicio
          </button>
        </div>

        {/* Contenedor principal */}
        <div className="piano-container" ref={this.pianoContainerRef}>

          {/* Mano en el centro superior */}
          <div className="hand-wrapper">
            <Hand fingerColors={fingerColors} />
          </div>

          {/* Botón para iniciar práctica */}
          {!practiceStarted && !showCountdown && (
            <div className="start-button-wrapper">
              <button className="boton-practica" onClick={this.comenzarPractica}>
                COMENZAR
              </button>
            </div>
          )}

          {/* Cuenta regresiva */}
          {showCountdown && (
            <div className="countdown-display">
              {countdown}
            </div>
          )}

          {/* Notas descendentes tipo Synthesia */}
          {practiceStarted && (
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
                />
              ))}
            </div>
          )}

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
                src={`../../notes/${note}.mp3`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
}

export { Piano };
