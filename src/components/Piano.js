<<<<<<< Updated upstream
// Importación de librerías necesarias y archivos del proyecto
import _ from 'lodash';
import React from 'react';
import './Piano.css'; // Estilos específicos para el componente Piano
import { Key } from './Key.js'; // Componente visual para representar una tecla
import {
  NOTES,        // Lista ordenada de las notas musicales (nombres de archivo y etiquetas)
  MIDI_TO_NOTE, // Mapeo de número MIDI → nombre de nota (ej: 60 → 'do4')
} from '../global/constants';
=======
import React from 'react';
import mqtt from 'mqtt';
import './Piano.css';
import { Key } from './Key.js';
import { NOTES, MIDI_TO_NOTE } from '../global/constants';
import { Hand } from './Hand.js';
>>>>>>> Stashed changes

// Este componente representa el piano completo y maneja:
// - Conexión con un teclado MIDI físico
// - Reproducción de sonidos
// - Visualización de teclas presionadas
class Piano extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
<<<<<<< Updated upstream
      pressedNotes: [], // Guarda qué notas están presionadas en ese momento
=======
      pressedNotes: [],
      fingerColors: {
        thumb: "#cccccc",
        index: "#cccccc",
        middle: "#cccccc",
        ring: "#cccccc",
        pinky: "#cccccc",
      }
>>>>>>> Stashed changes
    };

    this.client = null;
  }

  // Cuando aparece en pantalla el piano, se intenta conectar con dispositivos MIDI
  componentDidMount() {
    this.connectMQTT();

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(this.onMIDISuccess, this.onMIDIFailure);
    } else {
      console.warn("Web MIDI API no soportada en este navegador.");
    }
  }

<<<<<<< Updated upstream
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
      <div>
        <div className="piano">
          {NOTES.map((note, index) => (
            <Key
            key={index}                  // Clave única para React
            note={note}                  // Nombre de la nota (ej. 'fa4')
            pressedKeys={this.state.pressedNotes} // Notas actualmente activas
          />
          ))}
        </div>
        <div>
          {NOTES.map((note, index) => (
            <audio
            id={note}                                // id para buscar por JavaScript
            key={index}
            src={`../../notes/${note}.mp3`}          // Ruta relativa al archivo de sonido
          />
          ))}
        </div>
      </div>
    );
=======
  componentWillUnmount() {
    if (this.client) {
      this.client.end();
    }
  }

  connectMQTT() {
    const options = {
      username: 'PianoBroker',
      password: 'PapaPitufo420',
      keepalive: 7200,
      reconnectPeriod: 1000,
      protocol: 'wss', // WebSocket Secure
      // Cambia esto a la URL de tu broker MQTT con WebSocket
      // Por ejemplo: 'wss://dae3db229f2d427b820bf6346fece546.s1.eu.hivemq.cloud/mqtt'
      // Ajusta según tu servidor
    };

    this.client = mqtt.connect('wss://dae3db229f2d427b820bf6346fece546.s1.eu.hivemq.cloud/mqtt', options);

    this.client.on('connect', () => {
      console.log('Conectado al broker MQTT');
      // Suscribirse a los tópicos que publicas desde el Pico W
      this.client.subscribe('picow/led1');
      this.client.subscribe('picow/led2');
      this.client.subscribe('picow/led3');
      this.client.subscribe('picow/led4');
      this.client.subscribe('picow/led5');
    });

    this.client.on('message', (topic, message) => {
      const msg = message.toString();
      console.log(`Mensaje recibido en ${topic}: ${msg}`);

      // Actualizar colores según el tópico y mensaje
      this.setState((prevState) => {
        const newColors = { ...prevState.fingerColors };

        // Mapear tópicos a dedos
        const topicToFinger = {
          'picow/led1': 'thumb',
          'picow/led2': 'index',
          'picow/led3': 'middle',
          'picow/led4': 'ring',
          'picow/led5': 'pinky',
        };

        const finger = topicToFinger[topic];

        if (finger) {
          newColors[finger] = msg === 'y' ? '#00ff00' : '#cccccc'; // verde si activo, gris si no
        }

        return { fingerColors: newColors };
      });
    });

    this.client.on('error', (err) => {
      console.error('Error MQTT:', err);
    });
  }

  // (Tu resto del código MIDI y render sigue igual...)

  render() {
    return React.createElement('div', { className: 'piano-container' }, [
      React.createElement('div', { className: 'hand-wrapper', key: 'hand' },
        React.createElement(Hand, { fingerColors: this.state.fingerColors })
      ),
      React.createElement('div', { className: 'piano', key: 'keys' },
        NOTES.map((note, index) =>
          React.createElement(Key, {
            key: index,
            note: note,
            pressedKeys: this.state.pressedNotes
          })
        )
      ),
      React.createElement('div', { key: 'audios' },
        NOTES.map((note, index) =>
          React.createElement('audio', {
            id: note,
            key: index,
            src: `../../notes/${note}.mp3`
          })
        )
      )
    ]);
>>>>>>> Stashed changes
  }
}

export { Piano }; // Exporta el componente Piano para que pueda ser usado desde App.js