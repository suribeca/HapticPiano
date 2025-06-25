import React from 'react';
import './Key.css';

class Key extends React.Component {
  noteIsFlat = (note) => {
    return note.charAt(0) === 'z'; // Para notas sostenidas (flat)
  };

  keyIsPressed = (note) => {
    return this.props.pressedKeys.includes(note); // Verifica si la nota está presionada, comparando con las teclas activas recibidas como prop
  };

  render() {
    const { note } = this.props;
    const noteIsFlat = this.noteIsFlat(note); // Evalúa si la nota es sostenida o no
    const keyIsPressed = this.keyIsPressed(note); // Evalúa si la tecla está actualmente presionada

    let keyClassName = "key";
    if (noteIsFlat) {
      keyClassName += " flat";
    }
    if (keyIsPressed) {
      keyClassName += " pressed"; // Aplica efecto visual de tecla presionada
    }

    // Renderiza una tecla negra sin texto, o una tecla blanca con la nota visible}
    // Esto hace que cada tecla del piano tenga un id único basado en su nombre 
    // (do4, zsol4, etc.), que es justo lo que necesita el componente FallingNote.js 
    // para posicionarse correctamente sobre ella.
    return noteIsFlat ? (
      <div className={keyClassName} id={note}></div> 
    ) : (
      <div className={keyClassName} id={note}>
        <div className="key-text">{note.toUpperCase()}</div>
      </div>
    );
  }
}

export { Key };