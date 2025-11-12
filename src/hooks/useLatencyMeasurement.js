// src/hooks/useLatencyMeasurement.js
// Hook para medir latencia completa del sistema:
// Tecla MIDI presionada → MQTT publish → Pico procesa → MQTT response → React recibe

import { useEffect, useRef } from 'react';

// Tracker global de latencias
const latencyTracker = {
  keyPressTimestamps: {},
  measurements: [],
  stats: {
    count: 0,
    sum: 0,
    min: null,
    max: null,
    last: null
  }
};

/**
 * Hook para medir latencia end-to-end del sistema
 * 
 * @param {Array} pressedNotes - Array de notas MIDI presionadas actualmente
 * @param {Object} fingerStatusRef - Ref con el estado de los dedos del guante
 */
export const useLatencyMeasurement = (pressedNotes, fingerStatusRef) => {
  const lastPressedNotesRef = useRef([]);

  // Detectar cuando se presiona una nueva tecla
  useEffect(() => {
    const newNotes = pressedNotes.filter(
      note => !lastPressedNotesRef.current.includes(note)
    );

    if (newNotes.length > 0) {
      const timestamp = performance.now();
      newNotes.forEach(note => {
        latencyTracker.keyPressTimestamps[note] = timestamp;
        console.log(`[TECLA] ${note} presionada en ${timestamp.toFixed(2)}ms`);
      });
    }

    lastPressedNotesRef.current = pressedNotes;
  }, [pressedNotes]);

  // Detectar cuando el Pico responde (dedo presionado)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const currentStatus = fingerStatusRef.current;
      
      // Encontrar dedos activos
      const activeFingers = Object.entries(currentStatus)
        .filter(([_, pressed]) => pressed)
        .map(([finger]) => finger);

      if (activeFingers.length > 0) {
        const receiveTime = performance.now();
        
        // Buscar la tecla más reciente presionada
        const timestamps = Object.entries(latencyTracker.keyPressTimestamps);
        if (timestamps.length > 0) {
          const [note, pressTime] = timestamps.reduce((latest, current) => 
            current[1] > latest[1] ? current : latest
          );

          const latency = receiveTime - pressTime;

          // Actualizar estadísticas
          latencyTracker.stats.count++;
          latencyTracker.stats.sum += latency;
          latencyTracker.stats.last = latency;
          
          if (latencyTracker.stats.min === null || latency < latencyTracker.stats.min) {
            latencyTracker.stats.min = latency;
          }
          if (latencyTracker.stats.max === null || latency > latencyTracker.stats.max) {
            latencyTracker.stats.max = latency;
          }

          latencyTracker.measurements.push({
            note,
            latency,
            timestamp: receiveTime,
            fingers: activeFingers
          });

          const avg = latencyTracker.stats.sum / latencyTracker.stats.count;

          console.log(`
╔════════════════════════════════════════╗
║   LATENCIA COMPLETA (MIDI→Pico→React)  ║
╠════════════════════════════════════════╣
║ Tecla: ${note.padEnd(8)} → ${activeFingers.join(', ')}
║ Latencia: ${latency.toFixed(2)}ms
║ 
║ Estadísticas actuales:
║ ├─ Mínima:   ${latencyTracker.stats.min.toFixed(2)}ms
║ ├─ Máxima:   ${latencyTracker.stats.max.toFixed(2)}ms
║ ├─ Promedio: ${avg.toFixed(2)}ms
║ └─ Muestras: ${latencyTracker.stats.count}
╚════════════════════════════════════════╝
          `.trim());

          // Limpiar timestamp usado
          delete latencyTracker.keyPressTimestamps[note];
        }
      }
    }, 10); // Check cada 10ms

    return () => clearInterval(checkInterval);
  }, [fingerStatusRef]);
};

// ===============================================================
// UTILIDADES GLOBALES (disponibles en consola del navegador)
// ===============================================================

/**
 * Muestra estadísticas detalladas en consola
 * Uso: showLatencyStats()
 */
window.showLatencyStats = () => {
  const stats = latencyTracker.stats;
  if (stats.count === 0) {
    console.log('⚠️ No hay mediciones todavía');
    return;
  }

  const avg = stats.sum / stats.count;
  const distribution = generateDistribution(latencyTracker.measurements);
  
  console.log(`
╔════════════════════════════════════════╗
║       ESTADÍSTICAS DE LATENCIA         ║
╠════════════════════════════════════════╣
║ Total de mediciones: ${stats.count}
║ 
║ Latencia mínima:   ${stats.min.toFixed(2)}ms
║ Latencia máxima:   ${stats.max.toFixed(2)}ms
║ Latencia promedio: ${avg.toFixed(2)}ms
║ Última medición:   ${stats.last.toFixed(2)}ms
║
║ Distribución por rangos:
${distribution}
╚════════════════════════════════════════╝
  `.trim());
};

/**
 * Resetea todas las estadísticas
 * Uso: resetLatencyStats()
 */
window.resetLatencyStats = () => {
  latencyTracker.measurements = [];
  latencyTracker.keyPressTimestamps = {};
  latencyTracker.stats = {
    count: 0,
    sum: 0,
    min: null,
    max: null,
    last: null
  };
  console.log('✅ Estadísticas reseteadas');
};

/**
 * Exporta mediciones a archivo CSV
 * Uso: exportLatencyResults()
 */
window.exportLatencyResults = () => {
  if (latencyTracker.measurements.length === 0) {
    console.log('⚠️ No hay mediciones para exportar');
    return;
  }

  const csv = [
    'Nota,Latencia(ms),Timestamp,Dedos',
    ...latencyTracker.measurements.map(m => 
      `${m.note},${m.latency.toFixed(2)},${m.timestamp.toFixed(2)},"${m.fingers.join(', ')}"`
    )
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `latency_${Date.now()}.csv`;
  a.click();
  
  console.log(`✅ Exportadas ${latencyTracker.measurements.length} mediciones`);
};

/**
 * Genera histograma de distribución de latencias
 */
function generateDistribution(measurements) {
  const ranges = [
    { max: 50, label: '0-50ms   ', min: 0 },
    { max: 100, label: '50-100ms ', min: 50 },
    { max: 200, label: '100-200ms', min: 100 },
    { max: 500, label: '200-500ms', min: 200 },
    { max: Infinity, label: '>500ms   ', min: 500 }
  ];

  const distribution = ranges.map(range => {
    const count = measurements.filter(m => 
      m.latency > range.min && m.latency <= range.max
    ).length;
    
    const percentage = measurements.length > 0 
      ? (count / measurements.length * 100).toFixed(1) 
      : '0.0';
    const barLength = Math.floor(count / measurements.length * 30);
    const bar = '█'.repeat(barLength);
    
    return `║ ${range.label}: ${bar.padEnd(30)} ${count} (${percentage}%)`;
  });

  return distribution.join('\n');
}

// Mensaje de inicialización
console.log(`
╔════════════════════════════════════════════════════════════╗
║  SISTEMA DE MEDICIÓN DE LATENCIA ACTIVADO                  ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  El sistema medirá automáticamente la latencia completa   ║
║  desde que presionas una tecla MIDI hasta que el guante   ║
║  responde con feedback háptico.                           ║
║                                                            ║
║  COMANDOS DISPONIBLES:                                    ║
║  ├─ showLatencyStats()     - Ver estadísticas detalladas  ║
║  ├─ resetLatencyStats()    - Reiniciar mediciones         ║
║  └─ exportLatencyResults() - Exportar datos a CSV         ║
║                                                            ║
║  Toca el piano para comenzar las mediciones...           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
`);