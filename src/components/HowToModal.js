import React, { useEffect, useRef, useState } from "react";
import "./HowToModal.css";

/**
 * Modal de instrucciones previo a la práctica o demo.
 * Props:
 *  - open: boolean -> controla visibilidad
 *  - mode: 'cancion' | 'demo'
 *  - onClose: () => void -> cierra el modal (habilita "Comenzar")
 */
export default function HowToModal({ open, mode = "cancion", onClose }) {
  const dialogRef = useRef(null);
  const [dontShow, setDontShow] = useState(false);

  // Enfoque inicial y cierre con ESC
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    function onKey(e) {
      if (!open) return;
      if (e.key === "Escape") onCloseInternal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onCloseInternal = () => {
    if (dontShow) {
      // Guardar preferencia en esta sesión/navegador
      localStorage.setItem("hideHowToModal", "1");
    }
    onClose && onClose();
  };

  // Contenido según modo
  const isDemo = mode !== "cancion";

  return (
    <div
      className={`howto-overlay ${open ? "open" : ""}`}
      aria-hidden={!open}
      onClick={(e) => {
        // Evitar cerrar si da click en el fondo por accidente
        // (si lo prefieres, quítalo y permite cerrar por click en overlay)
        e.stopPropagation();
      }}
    >
      <div
        className="howto-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="howto-title">¿Cómo usar la práctica?</h2>

        {!isDemo && (
          <>
            <div className="howto-block">
              <h3>1) Las notas y el puntaje</h3>
              <p>
                Verás <strong>notas descendiendo</strong> hacia sus teclas.
                Debes <strong>presionarlas cuando toquen la línea roja</strong>.
              </p>
              <ul className="howto-list">
                <li><strong>100 puntos</strong> si presionas justo en la línea roja.</li>
                <li><strong>50 puntos</strong> si presionas muy cerca de la línea roja.</li>
                <li><strong>0 puntos</strong> si presionas muy temprano o muy tarde.</li>
              </ul>
              <p>
                Entre mayor puntaje, <strong>mejor calificación final</strong>.
              </p>
            </div>
            <div className="howto-block">
              <h3>2) El guante háptico</h3>
              <p>
                Al presionar una tecla con el dedo que tenga sensor, en la app
                verás qué dedo fue y sentirás la <strong>vibración del motor correspondiente</strong>.
              </p>
            </div>
          </>
        )}

        {isDemo && (
          <div className="howto-block">
            <h3>Modo Demo</h3>
            <p>
              En este modo podrás <strong>probar el guante</strong> sin la mecánica de puntajes:
              al presionar con un dedo sensorizado, verás en la app qué dedo fue y
              se activará la <strong>vibración correspondiente</strong>.
            </p>
          </div>
        )}

        <div className="howto-actions">
          <label className="dontshow">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
            />
            No volver a mostrar
          </label>

          <button className="howto-primary" onClick={onCloseInternal}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}