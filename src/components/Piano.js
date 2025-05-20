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
import { connectMQTT } from '../services/MqttClient'; // Conexión MQTT

// Este componente representa el piano completo
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
        pinky: "#cccccc",
      }
    };
  }
  
componentDidMount() {
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(this.onMIDISuccess, this.onMIDIFailure);
  } else {
    console.warn("Web MIDI API no soportada en este navegador.");
  }

  connectMQTT((data) => {
    console.log("Colores recibidos:", data);
    this.setState({ fingerColors: data });
  });
}
  // Callback MQTT: actualiza los colores al recibir datos del broker
  handleMQTTMessage = (data) => {
    this.setState({ fingerColors: data });
  };


  onMIDISuccess = (midiAccess) => {
    for (let input of midiAccess.inputs.values()) {
      console.log("Dispositivo MIDI conectado:", input.name);
      input.onmidimessage = this.handleMIDIMessage;
    }
  };

  onMIDIFailure = () => {
    console.error("No se pudo acceder a dispositivos MIDI.");
  }

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
  }

  playNote = (note) => {
    const audioElement = document.getElementById(note);
    if (!audioElement) {
      console.warn(`No se encontró el archivo de audio para: ${note}`);
      return;
    }
    const noteAudio = new Audio(audioElement.src);
    noteAudio.play();
  }

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

export { Piano };
// Exporta el componente Piano para que pueda ser usado desde App.js