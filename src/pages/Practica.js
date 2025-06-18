import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Practica.css'; // Importa estilos específicos

function Practica() {
  const [selectedSong, setSelectedSong] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [showError, setShowError] = useState(false);
  const navigate = useNavigate();

  const handleStart = () => {
    if (!selectedSong || !selectedLevel) {
      setShowError(true);
      return;
    }
    // Si todo bien, ir al demo
    navigate('/demo');
  };

  return (
    <div className="practica-container">
      <h2 className="titulo">Selecciona qué deseas practicar</h2>

      {/* Canciones */}
      <div className="opciones-grid">
        <button
          className={`opcion ${selectedSong === 'twinkle' ? 'seleccionado' : ''}`}
          onClick={() => { setSelectedSong('twinkle'); setShowError(false); }}
        >
          🎵 Twinkle Twinkle
        </button>
        <button
          className={`opcion ${selectedSong === 'ode' ? 'seleccionado' : ''}`}
          onClick={() => { setSelectedSong('ode'); setShowError(false); }}
        >
          🎶 Ode to Joy
        </button>
      </div>

      <h2 className="titulo">Dificultad</h2>

      {/* Dificultades */}
      <div className="opciones-grid">
        <button
          className={`opcion ${selectedLevel === 'facil' ? 'seleccionado' : ''}`}
          onClick={() => { setSelectedLevel('facil'); setShowError(false); }}
        >
          🐣 Fácil
        </button>
        <button
          className={`opcion ${selectedLevel === 'media' ? 'seleccionado' : ''}`}
          onClick={() => { setSelectedLevel('media'); setShowError(false); }}
        >
          🔔 Media
        </button>
        <button
          className={`opcion ${selectedLevel === 'dificil' ? 'seleccionado' : ''}`}
          onClick={() => { setSelectedLevel('dificil'); setShowError(false); }}
        >
          🦅 Difícil
        </button>
      </div>

      <button className="boton-practica" onClick={handleStart}>
        Comenzar práctica
      </button>

      {showError && (
        <div className="alerta">
          ⚠️ Debes seleccionar una canción y una dificultad antes de continuar.
        </div>
      )}
    </div>
  );
}

export default Practica;
