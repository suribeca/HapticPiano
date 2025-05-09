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

    // Renderiza una tecla negra sin texto, o una tecla blanca con la nota visible
    return noteIsFlat ? ( 
      <div className={keyClassName}></div> 
    ) : (
      <div className={keyClassName}>
        <div className="key-text">{note.toUpperCase()}</div>
      </div>
    );
  }
}

export { Key };