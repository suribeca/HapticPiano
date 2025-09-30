// Selector de práctica (sin imágenes)
// - Carrusel horizontal con tarjetas de canción (título + compositor/etiqueta)
// - Selector de dificultad en "chips"
// - Navega a /piano con {mode:"cancion", song, difficulty}

import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Practica.css";

const SONGS = [
  { id: "twinkle", title: "¿Estrellita Dónde Estás?", composer: "Tradicional" },
  { id: "ode",      title: "Himno a la Alegría",       composer: "L. v. Beethoven" },
  { id: "lamb",     title: "Mary Tenía un Corderito",  composer: "Tradicional" },
  { id: "canon",    title: "Canon en D",               composer: "J. Pachelbel" },
  { id: "solfa",    title: "Do-Re-Mi",                 composer: "R. Rodgers" },
];

const LEVELS = [
  { id: "facil", label: "Fácil" },
  { id: "normal", label: "Normal" },
  { id: "practica", label: "Difícil" },
];

export default function Practica() {
  const navigate = useNavigate();
  const railRef = useRef(null);

  const [selectedSong, setSelectedSong] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [showError, setShowError] = useState(false);

  const scrollByCards = (dir = 1) => {
    const rail = railRef.current;
    if (!rail) return;
    // Ancho aproximado de tarjeta + gap
    const card = rail.querySelector(".song-card");
    const step = card ? card.offsetWidth + 16 : 280;
    rail.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const handleStart = () => {
    if (!selectedSong || !selectedLevel) {
      setShowError(true);
      return;
    }
    navigate("/piano", {
      state: {
        mode: "cancion",
        song: selectedSong,
        difficulty: selectedLevel,
      },
    });
  };

  return (
    <div className="practice-wrap">
      <header className="practice-header">
        <h1 className="practice-title">Elige qué canción deseas practicar</h1>
        <p className="practice-sub">
          Desliza para explorar canciones y selecciona la dificultad.
        </p>
      </header>

      {/* Carrusel horizontal sin imágenes */}
      <section className="songs-section" aria-label="Lista de canciones">
        <button
          className="arrow-btn left"
          aria-label="Anterior"
          onClick={() => scrollByCards(-1)}
        >
          ‹
        </button>

        <div className="songs-rail" ref={railRef} role="listbox" aria-activedescendant={selectedSong || undefined} tabIndex={0}>
          {SONGS.map((s) => {
            const active = selectedSong === s.id;
            return (
              <button
                key={s.id}
                id={s.id}
                role="option"
                aria-selected={active}
                className={`song-card text-card ${active ? "active" : ""}`}
                onClick={() => {
                  setSelectedSong(s.id);
                  setShowError(false);
                }}
              >
                <div className="song-title">{s.title}</div>
                <div className="song-sub">{s.composer}</div>
                {active && <div className="radio-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <button
          className="arrow-btn right"
          aria-label="Siguiente"
          onClick={() => scrollByCards(1)}
        >
          ›
        </button>
      </section>

      {/* Selector de dificultad */}
      <section className="levels-section">
        <h2 className="levels-title">Dificultad</h2>
        <div className="levels-chips" role="radiogroup" aria-label="Dificultad">
          {LEVELS.map((lvl) => {
            const active = selectedLevel === lvl.id;
            return (
              <button
                key={lvl.id}
                role="radio"
                aria-checked={active}
                className={`chip ${active ? "chip-active" : ""}`}
                onClick={() => {
                  setSelectedLevel(lvl.id);
                  setShowError(false);
                }}
              >
                {lvl.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <div className="cta-row">
        <button
          className="start-btn"
          disabled={!selectedSong || !selectedLevel}
          onClick={handleStart}
        >
          Comenzar práctica
        </button>
      </div>

      {showError && (
        <div className="error-banner">
          ⚠️ Selecciona una <b>canción</b> y una <b>dificultad</b> para continuar.
        </div>
      )}
    </div>
  );
}
