import { useEffect, useRef } from "react";
import { profiler } from "../utils/profiler";

export const useFingerColors = (
  mode,
  fingerStatus,
  pressedNotes,
  lastScore,
  lastActiveFinger,
  setFingerColors,
  colors
) => {
  // Paso 3: memoizar colores
  const stableColors = useRef(colors);

  // Si el objeto colors realmente cambia (raro), actualizar ref
  if (stableColors.current !== colors) {
    stableColors.current = colors;
  }

  const prevRef = useRef(null);
  const prevStatusRef = useRef({});
  const prevNotesRef = useRef([]);

  const c = stableColors.current; // alias para menos ruido

  // ----------------------------
  // MODO LIBRE
  // ----------------------------
  useEffect(() => {
    profiler.step("react-latency", "computed color", { requireActive: true });

    if (mode !== "libre") return;

    const statusChanged =
      JSON.stringify(prevStatusRef.current) !== JSON.stringify(fingerStatus);
    const notesChanged =
      pressedNotes.length !== prevNotesRef.current.length;

    if (!statusChanged && !notesChanged) {
      return;
    }

    prevStatusRef.current = fingerStatus;
    prevNotesRef.current = pressedNotes;

    const hasNotesPressed = pressedNotes && pressedNotes.length > 0;
    const next = {};
    let changed = false;

    for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
      const isActive = fingerStatus[f] && hasNotesPressed;
      const newColor = isActive ? c.active : c.inactive;

      next[f] = newColor;

      if (!prevRef.current || prevRef.current[f] !== newColor) {
        changed = true;
      }
    }

    if (changed) {
      prevRef.current = next;
      setFingerColors(next);
    }
  }, [mode, fingerStatus, pressedNotes]);

  // ----------------------------
  // MODO CANCIÓN
  // ----------------------------
  useEffect(() => {
    if (mode !== "cancion" || lastScore == null) return;

    profiler.step("react-latency", "computed color (song)");

    const next = {};
    let changed = false;

    let color =
      lastScore === 100
        ? c.perfect
        : lastScore === 50
        ? c.good
        : c.miss;

    if (lastActiveFinger) {
      for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
        const newColor = f === lastActiveFinger ? color : c.inactive;
        next[f] = newColor;
        if (!prevRef.current || prevRef.current[f] !== newColor) {
          changed = true;
        }
      }
    } else {
      for (const f of ["thumb", "index", "middle", "ring", "pinky"]) {
        next[f] = c.miss;
        if (!prevRef.current || prevRef.current[f] !== c.miss) {
          changed = true;
        }
      }
    }

    if (changed) {
      prevRef.current = next;
      setFingerColors(next);
    }
  }, [lastScore, lastActiveFinger, mode]);
};
