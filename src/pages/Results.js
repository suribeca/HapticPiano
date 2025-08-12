import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea
} from 'recharts';
import { useState, useEffect } from 'react';
import './Results.css';

function Results() {
    const location = useLocation();
    const navigate = useNavigate();
    const score = location.state?.score ?? 0;
    const timingOffsets = location.state?.timingOffsets ?? [];
    const scores = location.state?.scores ?? [];
    const [value, setValue] = useState(0);

    const maxScore = timingOffsets.length * 100;

    const data = timingOffsets.map((offset, i) => ({
        index: i + 1,
        offset: parseFloat(offset.toFixed(1)),
    }));

    const counts = {
        100: scores.filter(s => s === 100).length,
        50: scores.filter(s => s === 50).length,
        0: scores.filter(s => s === 0).length,
    };

    // Función para calcular calificación tipo OSU
    function getGrade(score, maxScore, scores) {
        const allPerfect = scores.length > 0 && scores.every(s => s === 100);
        if (allPerfect) return 'S';

        const percent = (score / maxScore) * 100;

        if (percent >= 90) return 'A';
        if (percent >= 80) return 'B';
        if (percent >= 70) return 'C';
        if (percent >= 60) return 'D';
        return 'F';
    }

    const grade = getGrade(score, maxScore, scores);

    // Función para colorear puntos según precisión
    const renderDot = (props) => {
        const { cx, cy, payload } = props;
        const offset = Math.abs(payload.offset);

        let color = '#00ff00'; // Verde
        if (offset > 100) {
            color = '#ff0000'; // Rojo
        } else if (offset > 25) {
            color = '#ffff00'; // Amarillo
        }

        return (
            <circle
                cx={cx}
                cy={cy}
                r={4}
                stroke="black"
                strokeWidth={0.5}
                fill={color}
            />
        );
    };

    useEffect(() => {
        fetch('http://localhost:4000/api/save-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                score,
                maxScore,
                timingOffsets,
                scores,
                songName: 'ode',
                difficulty: 'practica'
            }),
        })
            .then(res => {
                if (!res.ok) throw new Error("Error al guardar resultados");
                console.log("✅ Resultados enviados");
            })
            .catch(err => console.error(err));
    }, []);

    return (
        <div className="results-container">
            <h1>🎉 ¡Has terminado!</h1>
            <p>Tu puntuación: <strong>{score}</strong></p>
            <p className={`grade grade-${grade.toLowerCase()}`}>
                Calificación: <strong>{grade}</strong>
            </p>

            <div className="chart-wrapper">
                <h2>Precisión (en milisegundos)</h2>
                <LineChart
                    width={600}
                    height={250}
                    data={data}
                    margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" label={{ value: "Nota", position: "insideBottom", offset: -5 }} />
                    <YAxis domain={[-200, 200]} label={{ value: "Offset (ms)", angle: -90, position: "insideLeft" }} />
                    <Tooltip formatter={(value) => `${value} ms`} />

                    {/* Zonas de precisión */}
                    <ReferenceArea y1={-200} y2={-100} fill="#ffcccc" fillOpacity={0.3} />
                    <ReferenceArea y1={-100} y2={-25} fill="#ffffcc" fillOpacity={0.3} />
                    <ReferenceArea y1={-25} y2={25} fill="#ccffcc" fillOpacity={0.3} />
                    <ReferenceArea y1={25} y2={100} fill="#ffffcc" fillOpacity={0.3} />
                    <ReferenceArea y1={100} y2={200} fill="#ffcccc" fillOpacity={0.3} />

                    <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />

                    <Line
                        type="monotone"
                        dataKey="offset"
                        stroke="#888888"
                        strokeWidth={2}
                        dot={renderDot}
                    />
                </LineChart>

                <div className="legend">
                    <p><span className="legend-box green"></span>Perfecto (±25ms)</p>
                    <p><span className="legend-box yellow"></span>Leve error (±100ms)</p>
                    <p><span className="legend-box red"></span>Error grave (&gt;100ms)</p>
                </div>
            </div>

            <div className="score-table">
                <h2>Resumen de precisión</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Resultado</th>
                            <th>Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>🟢 Excelente (100)</td>
                            <td>{counts[100]}</td>
                        </tr>
                        <tr>
                            <td>🟡 Bien (50)</td>
                            <td>{counts[50]}</td>
                        </tr>
                        <tr>
                            <td>🔴 Fallo (0)</td>
                            <td>{counts[0]}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <button className="volver-btn" onClick={() => navigate('/')}>
                Volver al menú
            </button>
        </div>
    );
}

export default Results;
