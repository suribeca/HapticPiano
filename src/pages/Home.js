import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">
      {/* Panel izquierdo: imagen o color de fondo */}
      <div className="left">
        {/* Puedes poner aquí un video, animación o imagen */}
        <img
          src="/img/pianoplayer1.jpg" // pon tu propia imagen si gustas
          alt="Joven tocando piano"
          className="image"
        />
      </div>

      {/* Panel derecho: texto + botones */}
      <div className="right">
        <h1 className="title">🎹 Piano Háptico</h1>
        <p className="subtitle">
          Aquí cualquiera puede practicar a su ritmo, a su estilo 🎧
        </p>

        <div className="buttons">
          <button onClick={() => navigate('/practica')}>Comenzar práctica</button>
          <button
            onClick={() =>
              navigate('/piano', {
                state: { mode: 'libre' }
              })
            }
            className="outline"
          >
            Explorar demo
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
