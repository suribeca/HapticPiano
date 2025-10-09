// Resultados de una práctica
// - Muestra: score total, desglose (100/50/0), gráfica de offsets en ms
// - A la derecha: calificación gigante (S/A/B/C/D/F) + mensaje motivacional
// - Botón para regresar a la selección de canciones (Practica.js)

import React, { useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea
} from 'recharts';
import './Results.css';

export default function Results() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // Datos que mandas desde Piano.js al finalizar
  const score          = state?.score ?? 0;
  const timingOffsets  = state?.timingOffsets ?? []; // ms (+ tarde / - temprano)
  const scores         = state?.scores ?? [];        // 100 / 50 / 0
  const songName       = state?.songName ?? '';
  const difficulty     = state?.difficulty ?? '';

  const maxScore = scores.length * 100;

  // Preparar datos para la gráfica (un punto por nota)
  const chartData = useMemo(
    () => timingOffsets.map((off, i) => ({ i: i + 1, offset: +off.toFixed(1) })),
    [timingOffsets]
  );

  // Conteos para la tabla
  const counts = useMemo(() => ({
    100: scores.filter(s => s === 100).length,
    50 : scores.filter(s => s === 50 ).length,
    0  : scores.filter(s => s === 0  ).length,
  }), [scores]);

  // Letra de calificación tipo OSU “lite”
  function getGrade(total, max, perNote) {
    if (perNote.length > 0 && perNote.every(v => v === 100)) return 'S';
    const p = max > 0 ? (total / max) * 100 : 0;
    if (p >= 90) return 'A';
    if (p >= 80) return 'B';
    if (p >= 70) return 'C';
    if (p >= 60) return 'D';
    return 'F';
  }

  const grade = getGrade(score, maxScore, scores);

  // Mensaje según calificación
  const praiseByGrade = {
    S: '¡Impecable! Ritmo perfecto y manos de pianista',
    A: '¡Brillante! Estás a nada de la perfección',
    B: '¡Muy bien! El progreso se nota',
    C: '¡Sólido! Un poco más de práctica y subes de nivel',
    D: '¡No te rindas! Repite las secciones difíciles y lo lograrás',
    F: 'Cada maestro fue principiante. ¡Intenta de nuevo!',
  };

  // POST de resultados al backend local
  useEffect(() => {
    fetch('http://localhost:4000/api/save-results', { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, maxScore, timingOffsets, scores, songName, difficulty })
    }).catch(()=>{});
  }, []);  // Solo al montar

  // Puntos coloreados por precisión (verde/amarillo/rojo)
  const renderDot = (props) => {
    const { cx, cy, payload } = props;
    const a = Math.abs(payload.offset);
    let color = '#00d66b';        // < ±35ms
    if (a > 100) color = '#ff3b3b';  // > ±100ms
    else if (a > 35) color = '#ffd84d';
    return <circle cx={cx} cy={cy} r={4} stroke="#111" strokeWidth={0.6} fill={color} />;
  };

  return (
    <div className="results-page">
      {/* Columna izquierda: score + tabla + gráfica */}
      <section className="left-col">
        {/* Cabecera compacta (arriba-izquierda) */}
        <div className="score-card">
          <div className="score-title">Puntuación</div>
          <div className="score-value">{score}</div>
          <div className="score-sub">
            {songName} · {difficulty.charAt(0).toUpperCase()+difficulty.slice(1)}
          </div>
        </div>

        {/* Tabla de aciertos/casis/fallos */}
        <div className="table-card">
          <div className="table-title">Resumen de precisión</div>
          <table>
            <thead>
              <tr>
                <th>Resultado</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="pill pill-100">100</span> Excelente</td>
                <td>{counts[100]}</td>
              </tr>
              <tr>
                <td><span className="pill pill-50">50</span> Cerca</td>
                <td>{counts[50]}</td>
              </tr>
              <tr>
                <td><span className="pill pill-0">0</span> Fallo</td>
                <td>{counts[0]}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gráfica de offsets con bandas de tolerancia y línea en 0 ms */}
        <div className="chart-card">
          <div className="chart-title">Precisión temporal (ms)</div>
          <LineChart width={680} height={260} data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3245" />
            <XAxis dataKey="i" tick={{ fill: '#c9c9d4' }} label={{ value: 'Nota', position: 'insideBottom', offset: -8, fill: '#c9c9d4' }} />
            <YAxis domain={[-200, 200]} tick={{ fill: '#c9c9d4' }} label={{ value: 'Offset (ms)', angle: -90, position: 'insideLeft', fill: '#c9c9d4' }}/>
            <Tooltip formatter={(v)=>`${v} ms`} contentStyle={{ background: '#1f2233', border: '1px solid #363a52', color:'#fff' }} />

            {/* Bandas: rojo (|offset|>100), amarillo (35..100), verde (<=35) */}
            <ReferenceArea y1={-200} y2={-100} fill="#ff3b3b" fillOpacity={0.12}/>
            <ReferenceArea y1={-100} y2={-35}  fill="#ffd84d" fillOpacity={0.12}/>
            <ReferenceArea y1={-35}  y2={35}   fill="#00d66b" fillOpacity={0.12}/>
            <ReferenceArea y1={35}   y2={100}  fill="#ffd84d" fillOpacity={0.12}/>
            <ReferenceArea y1={100}  y2={200}  fill="#ff3b3b" fillOpacity={0.12}/>

            <ReferenceLine y={0} stroke="#ff2f6d" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="offset" stroke="#9aa0ff" strokeWidth={2} dot={renderDot} />
          </LineChart>

          <div className="legend">
            <span><i className="box box-green" />Perfecto (&lt; ±35ms)</span>
            <span><i className="box box-yellow" />Leve error (±35–100ms)</span>
            <span><i className="box box-red" />Error (&gt; ±100ms)</span>
          </div>
        </div>

        {/* CTA */}
        <div className="cta-row">
          <button className="back-btn" onClick={() => navigate('/practica')}>Volver a seleccionar canción</button>
        
          <button className="volver-btn" onClick={() => navigate('/')}> ⬅ Volver al menú principal</button>
        </div>
      </section>

      {/* Columna derecha: letra gigante + mensaje */}
      <aside className="right-col">
        <div className={`grade-badge grade-${grade.toLowerCase()}`}>{grade}</div>
        <div className="praise">{praiseByGrade[grade]}</div>
        <div className="ratio">
          Precisión: <strong>{maxScore ? Math.round((score / maxScore) * 100) : 0}%</strong>
        </div>
        <div className="mini-meta">
          {scores.length} notas · Máximo {maxScore}
        </div>
      </aside>
    </div>
  );
}