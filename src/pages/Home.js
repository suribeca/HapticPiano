// src/components/Home.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* ----------- Sección Intro ----------- */}
      <section className="intro-section">
        <div className="intro-text">
          <h1 className="intro-title">
            Piano Háptico
          </h1>
          <p className="intro-subtitle">
            Cualquiera puede practicar a su ritmo, a su estilo
          </p>
          <div className="intro-buttons">
            <button
              className="btn-primary"
              onClick={() => navigate("/practica")}
            >
              Comenzar práctica
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigate('/piano', { state: { mode: 'libre' } })}
            >
              Explorar demo
            </button>
          </div>
        </div>
        <div className="intro-image">
          {/* Imagen desde public/img */}
          <img src="/img/girlPiano.png" alt="Niña tocando piano" />
        </div>
      </section>

      {/* ----------- Sección Misión ----------- */}
      <section className="mission-section">
        <div className="mission-image">
          <img src="/img/pianoplayer1.jpg" alt="Chico tocando piano" />
        </div>
        <div className="mission-text">
          <h2>Nuestra misión</h2>
          <p>
            Este proyecto busca hacer la música accesible para todas las
            personas, combinando tecnología, retroalimentación háptica y
            aprendizaje interactivo. Queremos que cada usuario, sin importar su
            experiencia, pueda disfrutar de tocar el piano de manera única y
            personalizada.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Home;
