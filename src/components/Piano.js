// Importación de librerías necesarias y archivos del proyecto
import _ from 'lodash';
import React from 'react';
import './Piano.css'; // Estilos específicos para el componente Piano
import { Key } from './Key.js'; // Componente visual para representar una tecla
import { Hand } from './Hand.js';
import {
  NOTES,        // Lista ordenada de las notas musicales (nombres de archivo y etiquetas)
  MIDI_TO_NOTE, // Mapeo de número MIDI → nombre de nota (ej: 60 → 'do4')
} from '../global/constants';

// Este componente representa el piano completo y maneja:
// - Conexión con un teclado MIDI físico
// - Reproducción de sonidos
// - Visualización de teclas presionadas
class Piano extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pressedNotes: [], //Guarda las notas presionadas
      fingerColors: {  //Inicializa dedos
        thumb: "#cccccc",
        index: "#cccccc",
        middle: "#cccccc",
        ring: "#cccccc",
        pinky: "#cccccc",
      }
    };
  }

  // Cuando aparece en pantalla el piano, se intenta conectar con dispositivos MIDI
  componentDidMount() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(this.onMIDISuccess, this.onMIDIFailure);
    } else {
      console.warn("Web MIDI API no soportada en este navegador.");
    }
  }

  // Si se conecta exitosamente a dispositivos MIDI
  onMIDISuccess = (midiAccess) => {
    // Itera sobre todos los dispositivos de entrada MIDI disponibles
    for (let input of midiAccess.inputs.values()) {
      console.log("Dispositivo MIDI conectado:", input.name);
      // Escucha eventos de mensajes MIDI en cada dispositivo
      input.onmidimessage = this.handleMIDIMessage;
    }
  };

  onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  }

  // Esta función se llama cada vez que llega un mensaje MIDI del teclado físico
  handleMIDIMessage = ({ data }) => {
    // Desestructura el arreglo de datos MIDI: [status, nota, intensidad]
    const [status, noteNumber, velocity] = data;

    // Códigos estándar MIDI
    const NOTE_ON = 144;
    const NOTE_OFF = 128;

    const isNoteOn = status === NOTE_ON && velocity > 0; // Se checa que la tecla esté presionada
    const isNoteOff = status === NOTE_OFF || (status === NOTE_ON && velocity === 0); // Se checa que la tecla sea soltada

    const noteName = MIDI_TO_NOTE[noteNumber];
    if (!noteName) return;

    // Si la nota es presionada
    if (isNoteOn) {
      // Agrega la nota al estado de teclas presionadas
      this.setState((prev) => ({
        pressedNotes: [...prev.pressedNotes, noteName],
      }));
      this.playNote(noteName); // Reproduce el sonido de la nota como output
    }

    // Si la nota no es presionada
    if (isNoteOff) {
      // Quita la nota del estado 
      this.setState((prev) => ({
        pressedNotes: prev.pressedNotes.filter((note) => note !== noteName),
      }));
    }
  }

  // Función para reproducir el sonido correspondiente de una nota 
  playNote = (note) => {
    // Busca el elemento <audio> con id igual al nombre de la nota (ej: <audio id="do4" />)
    const audioElement = document.getElementById(note);
    if (!audioElement) {
      console.warn(`No se encontró el archivo de audio para: ${note}`);
      return;
    }

    // Crea una nueva instancia del sonido y lo reproduce
    const noteAudio = new Audio(audioElement.src);
    noteAudio.play();
  }

  // Renderiza visualmente el piano y sus sonidos
  render() {
    return (
      <div className="piano-container">
        <div className="hand-wrapper">
          <Hand fingerColors={this.state.fingerColors} />
        </div>

        <div className="piano">
          {NOTES.map((note, index) => (
            <Key
              key={index}
              note={note}
              pressedKeys={this.state.pressedNotes}
            />
          ))}
        </div>

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
    );
  }
}

export { Piano }; // Exporta el componente Piano para que pueda ser usado desde App.js