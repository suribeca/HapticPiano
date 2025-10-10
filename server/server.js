// server.js (CommonJS)
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors()); // si quieres, restringe a tu origen con { origin: 'http://localhost:5173' }
app.use(express.json({ limit: '1mb' }));

// util: asegura carpeta y encabezado
const dataDir = path.join(__dirname, 'data');
const csvPath = path.join(dataDir, 'results.csv');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(
    csvPath,
    'timestamp,pieza,dificultad,puntaje_total,puntaje_maximo,notas_offset_ms,notas_resultado\n'
  );
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/save-results', (req, res) => {
  try {
    // 1) Lee y aplica defaults
    let {
      score = 0,
      maxScore = 0,
      timingOffsets = [],
      scores = [],
      songName = 'unknown',
      difficulty = 'unknown'
    } = req.body || {};

    // 2) Coerciones seguras
    const safeNumber = (x) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : 0;
    };

    // timingOffsets: a números con 1 decimal
    const offsetsStr = (Array.isArray(timingOffsets) ? timingOffsets : [])
      .map((v) => safeNumber(v))
      .map((n) => n.toFixed(1))
      .join('|');

    // scores: a enteros (por si llegan strings)
    const scoresInt = (Array.isArray(scores) ? scores : []).map((v) => parseInt(v, 10) || 0);
    const scoresStr = scoresInt.join('|');

    score = safeNumber(score);
    maxScore = safeNumber(maxScore);

    // 3) Escapar/encerrar strings con comillas para CSV
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

    // 4) Escribe
    fs.appendFile(csvPath, line, (err) => {
      if (err) {
        console.error('Error guardando resultados:', err);
        return res.status(500).json({ ok: false, error: 'FS_APPEND_ERROR' });
      }
      console.log('✅ Resultados guardados');
      res.status(200).json({ ok: true });
    });
  } catch (e) {
    console.error('Error en /api/save-results:', e);
    res.status(400).json({ ok: false, error: 'BAD_PAYLOAD', detail: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
