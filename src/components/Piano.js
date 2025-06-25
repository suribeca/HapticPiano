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
import { connectMQTT } from '../services/MqttClient'; // Conexión a broker MQTT
import { FallingNote } from './FallingNote'; // Notas que caen visualmente
import './FallingNote.css'; // Estilos para las notas que caen

// Componente principal del piano
class Piano extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pressedNotes: [],
      fingerColors: {
        thumb: "#ccc",
        index: "#ccc",
        middle: "#ccc",
        ring: "#ccc",
        pinky: "#ccc"
      },
      fallingNotes: [] // Notas a visualizar como animación descendente
    };
    // Referencia para centrar visualmente en do4 al cargar
    this.pianoContainerRef = React.createRef();
  }

  // Se ejecuta cuando el componente se monta
  componentDidMount() {
    // Conecta al dispositivo MIDI si está disponible
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(this.onMIDISuccess, this.onMIDIFailure);
    } else {
      console.warn("Web MIDI API no soportada en este navegador.");
    }

    // Escucha datos MQTT para actualizar colores de dedos
    connectMQTT((data) => {
      console.log("Colores recibidos:", data);
      this.setState({ fingerColors: data });
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

    if (isNoteOn) {
      this.setState((prev) => ({
        pressedNotes: [...prev.pressedNotes, noteName],
      }));
      this.playNote(noteName);
    }

    if (isNoteOff) {
      this.setState((prev) => ({
        pressedNotes: prev.pressedNotes.filter((note) => note !== noteName),
      }));
    }
  };

  // Reproduce el archivo de audio correspondiente a la nota
  playNote = (note) => {
    // Corrección específica para La, La# y Si (que suenan una octava abajo)
    const match = note.match(/^(la|zla|si)(\d)$/);
    let notaCorregida = note;

    if (match) {
      const [, base, octava] = match;
      const nuevaOctava = parseInt(octava) + 1;
      notaCorregida = `${base}${nuevaOctava}`;
    }

    const audioElement = document.getElementById(notaCorregida);
    if (!audioElement) {
      console.warn(`No se encontró el archivo de audio para: ${notaCorregida}`);
      return;
    }

    const noteAudio = new Audio(audioElement.src);
    noteAudio.play();
  };

  render() {
    // Filtra las notas que serán visualizadas (hasta do6 inclusive)
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

        {/* Contenedor principal del piano y la mano */}
        <div className="piano-container" ref={this.pianoContainerRef}>

          {/* Mano centrada visualmente */}
          <div className="hand-wrapper">
            <Hand fingerColors={this.state.fingerColors} />
          </div>

          {/* Visualización de notas descendentes sincronizadas */}
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
            {this.state.fallingNotes.map((n, i) => (
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

          {/* Teclado horizontal scrolleable */}
          <div className="piano">
            {VISIBLE_NOTES.map((note, index) => (
              <Key
                key={index}
                note={note}
                pressedKeys={this.state.pressedNotes}
              />
            ))}
          </div>

          {/* Audios ocultos para todas las notas */}
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
