import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine
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

    // Estructura para gráfica: [{index: 0, offset: -25}, ...]
    const data = timingOffsets.map((offset, i) => ({
        index: i + 1,
        offset: parseFloat(offset.toFixed(1)),
    }));

    // Contar ocurrencias
    const counts = {
        100: scores.filter(s => s === 100).length,
        50: scores.filter(s => s === 50).length,
        0: scores.filter(s => s === 0).length,
    };

    const Playit = () => {
        var audio = new Audio("/sounds/applauseCheer.mp3");
        audio.play().catch(() => { console.warn("Autoplay bloqueado"); });
    };
    useEffect(() => { Playit() }, []);


    return (
        <div className="results-container">
            <h1>🎉 ¡Has terminado!</h1>
            <p>Tu puntuación: <strong>{score}</strong></p>

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
                    <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                    <Line
                        type="monotone"
                        dataKey="offset"
                        stroke="#00ff00"
                        dot={{ r: 2 }}
                        strokeWidth={2}
                    />
                </LineChart>
            </div>

            {/* Tabla de precisión */}
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
