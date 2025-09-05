import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home">

      {/* HERO SECTION */}
      <section className="section hero">
        <div className="content">
          <h1 className="title">Piano Háptico</h1>
          <p className="subtitle">
            Cualquiera puede practicar a su ritmo, a su estilo 🎧
          </p>
        </div>
        <img
          src="/img/pianoplayer1.jpg"
          alt="Joven tocando piano"
          className="background-image"
        />
      </section>

      {/* MISIÓN */}
      <section className="section mission">
        <div className="content">
          <h1 className= "title">Nuestra misión</h1>
          <p className="subtitle">
            Este proyecto busca acercar la música a personas con discapacidad auditiva,
            brindándoles una forma innovadora de sentir y practicar el piano a través
            de retroalimentación háptica.
          </p>

          <p className="subtitle">
            Este sistema está diseñado para mejorar la experiencia educativa, 
            haciéndola más accesible y efectiva para personas con discapacidad auditiva, 
            permitiéndoles interpretar y comprender la música a través de estímulos táctiles 
            y visuales que complementen la percepción auditiva ausente.
          </p>
        </div>
      </section>

      {/* OPCIONES */}
      <section className="section options">
        <div className="content">
          <h2 className="title">Elige cómo quieres comenzar</h2>
          <div className="buttons">
            <button onClick={() => navigate('/practica')}>Comenzar práctica</button>
            <button
              onClick={() =>
                navigate('/piano', { state: { mode: 'libre' } })
              }
              className="outline"
            >
              Explorar demo
            </button>
          </div>
        </div>
        <img
          src="/img/girlPiano.png"
          alt="Niña usando sistema"
          className="background-image"
        />
      </section>
      
    </div>
  );
}

export default Home;
