import React from 'react';
import './Key.css';

class Key extends React.Component {
  noteIsFlat = (note) => {
    return note.charAt(0) === 'z'; // Para notas sostenidas (flat)
  };

  keyIsPressed = (note) => {
    return this.props.pressedKeys.includes(note); // Verifica si la nota está presionada
  };

  render() {
    const { note } = this.props;
    const noteIsFlat = this.noteIsFlat(note);
    const keyIsPressed = this.keyIsPressed(note);

    let keyClassName = "key";
    if (noteIsFlat) {
      keyClassName += " flat";
    }
    if (keyIsPressed) {
      keyClassName += " pressed";
    }

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