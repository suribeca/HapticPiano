
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());
app.use(express.json());

app.post('/api/save-results', (req, res) => {
  const { 
    score, 
    maxScore, 
    timingOffsets, 
    scores, 
    songName = 'unknown', 
    difficulty = 'unknown' 
  } = req.body;

  const timestamp = new Date().toISOString();

  // Convierte arreglos a strings separados por "|"
  const offsetsStr = timingOffsets.map(n => n.toFixed(1)).join('|');
  const scoresStr = scores.join('|');

  const line = [
    timestamp,
    songName,
    difficulty,
    score,
    maxScore,
    `"${offsetsStr}"`,
    `"${scoresStr}"`
  ].join(',') + '\n';

  const csvPath = path.join(__dirname, 'results.csv');

  // Si el archivo no existe, agregamos header
  if (!fs.existsSync(csvPath)) {
    const header = 'timestamp,pieza,dificultad,puntaje_total,puntaje_maximo,notas_offset_ms,notas_resultado\n';
    fs.writeFileSync(csvPath, header);
  }

  fs.appendFile(csvPath, line, (err) => {
    if (err) {
      console.error('Error guardando resultados:', err);
      return res.status(500).send('Error al guardar');
    }
    console.log('✅ Resultados guardados');
    res.status(200).send('Guardado con éxito');
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
