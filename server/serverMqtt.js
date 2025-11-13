// server.js - Express API + Broker MQTT Aedes integrado
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');

// MQTT Broker
const aedes = require('aedes')();
const net = require('net');
const ws = require('websocket-stream');

const app = express();
const PORT = 4000;

// ================================================================
// CONFIGURACIÓN EXPRESS
// ================================================================

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Asegurar estructura de archivos
const dataDir = path.join(__dirname, 'data'); 
const csvPath = path.join(dataDir, 'results.csv');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(
    csvPath,
    'timestamp,pieza,dificultad,puntaje_total,puntaje_maximo,notas_offset_ms,notas_resultado\n'
  );
}

// ================================================================
// RUTAS EXPRESS
// ================================================================

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/save-results', (req, res) => {
  try {
    let {
      score = 0,
      maxScore = 0,
      timingOffsets = [],
      scores = [],
      songName = 'unknown',
      difficulty = 'unknown'
    } = req.body || {};

    const safeNumber = (x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    };

    const offsetsStr = (Array.isArray(timingOffsets) ? timingOffsets : [])
      .map((v) => safeNumber(v)) 
      .map((n) => n.toFixed(1))
      .join('|'); 

    const scoresInt = (Array.isArray(scores) ? scores : []).map((v) => parseInt(v, 10) || 0);
    const scoresStr = scoresInt.join('|'); 

    score = safeNumber(score); 
    maxScore = safeNumber(maxScore); 

    const q = (s) => `"${String(s).replace(/"/g, '""')}"`; 

    const timestamp = new Date().toISOString(); 
    const line = [
      timestamp,
      q(songName),
      q(difficulty),
      score,
      maxScore,
      q(offsetsStr),
      q(scoresStr)
    ].join(',') + '\n';

    fs.appendFile(csvPath, line, (err) => {
      if (err) {
        console.error('Error guardando resultados:', err);
        return res.status(500).json({ ok: false, error: 'FS_APPEND_ERROR' });
      }
      console.log('Resultados guardados');
      res.status(200).json({ ok: true });
    });
  } catch (e) {
    console.error('Error en /api/save-results:', e);
    res.status(400).json({ ok: false, error: 'BAD_PAYLOAD', detail: String(e) });
  }
});

// ================================================================
// BROKER MQTT AEDES (OPTIMIZADO PARA BAJA LATENCIA)
// ================================================================

// Eventos del broker (opcional para monitoreo)
aedes.on('client', (client) => {
  console.log(`[MQTT] Cliente conectado: ${client.id}`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[MQTT] Cliente desconectado: ${client.id}`);
});

aedes.on('publish', (packet, client) => {
  // Log solo para debug (comentar en producción)
  if (client && process.env.MQTT_DEBUG) {
    console.log(`[MQTT] ${packet.topic} - ${packet.payload.length} bytes`);
  }
});

// Servidor MQTT TCP (puerto 1883) - Para Pico W
const mqttTcpServer = net.createServer(aedes.handle);
mqttTcpServer.listen(1883, '0.0.0.0', () => {
  console.log('✅ MQTT TCP: 0.0.0.0:1883 (Pico W)');
});

// Servidor HTTP para Express + WebSocket MQTT (puerto 9001) - Para React
const httpServer = http.createServer(app);

// WebSocket MQTT en el mismo servidor HTTP
ws.createServer({ server: httpServer }, aedes.handle);

// Iniciar servidor combinado
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║      SERVIDOR INTEGRADO ACTIVO         ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║ Express API:   http://localhost:${PORT}    ║`);
  console.log('║ MQTT TCP:      0.0.0.0:1883 (Pico W)   ║');
  console.log(`║ MQTT WebSocket: ws://localhost:${PORT}     ║`);
  console.log('║ Optimizado para latencia mínima        ║');
  console.log('╚════════════════════════════════════════╝\n');
});

// WebSocket MQTT adicional en puerto 9001 (para compatibilidad)
const wsServer = http.createServer();
ws.createServer({ server: wsServer }, aedes.handle);
wsServer.listen(9001, '0.0.0.0', () => {
  console.log('✅ MQTT WebSocket adicional: 0.0.0.0:9001');
});

// Optimizaciones
process.setMaxListeners(0);
if (aedes.mq) aedes.mq.maxListeners = 0;

// Manejo de errores
process.on('uncaughtException', (err) => {
  console.error('[ERROR]', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[UNHANDLED REJECTION]', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SHUTDOWN] Cerrando servidor...');
  aedes.close(() => {
    console.log('[SHUTDOWN] Broker MQTT cerrado');
    httpServer.close(() => {
      console.log('[SHUTDOWN] Servidor HTTP cerrado');
      process.exit(0);
    });
  });
});