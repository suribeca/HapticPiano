import _ from 'lodash';
import React from 'react';
import './Piano.css';
import { Key } from './Key.js';
import {
  NOTES,
  MIDI_TO_NOTE,
} from '../global/constants';

class Piano extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      pressedNotes: [],
    };
  }

  componentDidMount() {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(this.onMIDISuccess, this.onMIDIFailure);
    } else {
      console.warn("Web MIDI API no soportada en este navegador.");
    }
  }

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
      <div>
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
