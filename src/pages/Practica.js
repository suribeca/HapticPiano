import React, { useState } from 'react';

function Practica() {
  const [cancion, setCancion] = useState('');
  const [dificultad, setDificultad] = useState('');

  const iniciarPractica = () => {
    alert(`Practicando "${cancion}" con dificultad "${dificultad}"`);
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>🎵 Selecciona una canción</h2>
      <select onChange={(e) => setCancion(e.target.value)}>
        <option value="">-- Canciones --</option>
        <option value="Twinkle Twinkle">Twinkle Twinkle</option>
        <option value="Ode to Joy">Ode to Joy</option>
      </select>

      <h2>🎚️ Dificultad</h2>
      <select onChange={(e) => setDificultad(e.target.value)}>
        <option value="">-- Dificultad --</option>
        <option value="Fácil">Fácil</option>
        <option value="Media">Media</option>
        <option value="Difícil">Difícil</option>
      </select>

      <br /><br />
      <button onClick={iniciarPractica}>Comenzar práctica</button>
    </div>
  );
}

export default Practica;
