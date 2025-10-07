import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook para cargar las notas de una canción desde archivos JSON
 * @param {string} song - ID de la canción (ej. 'ode', 'twinkle')
 * @param {string} difficulty - Dificultad: 'facil' | 'normal' | 'dificil' | 'practica'
 * @param {Function} navigate - Función de navegación de react-router
 * @returns {Object} { fallingNotes, setFallingNotes, loading, error }
 */
export const useSongLoader = (song, difficulty, navigate) => {
  const [fallingNotes, setFallingNotes] = useState([]);  // lista de {id, note, time}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Validación: si faltan datos, regresar a selección
    if (!song || !difficulty) {
      navigate('/practica');
      return;
    }

    // Normalizar dificultad (legado: 'practica' -> 'normal')
    const normalizedDifficulty = difficulty === 'practica' ? 'normal' : difficulty;

    // Construir nombre del archivo con capitalización
    // Ejemplo: odeFacil.json, odeNormal.json, odeDificil.json
    const capitalizedDifficulty = normalizedDifficulty.charAt(0).toUpperCase() + normalizedDifficulty.slice(1);
    const fileName = `${song}${capitalizedDifficulty}.json`;

    // Cargar archivo JSON
    setLoading(true);
    setError(null);

    fetch(`/songs/${fileName}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`No se pudo cargar ${fileName}: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        // Asegurar un id único por nota para React keys
        const notesWithIds = data.map(note => ({ 
          ...note, 
          id: uuidv4() 
        }));
        
        setFallingNotes(notesWithIds);
        setLoading(false);
        console.log(`Cargado /songs/${fileName} (${notesWithIds.length} notas)`);
      })
      .catch(err => {
        console.error('Error al cargar notas JSON:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [song, difficulty, navigate]);

  return { 
    fallingNotes, 
    setFallingNotes, 
    loading, 
    error 
  };
};