export const profiler = (() => {
  const active = {};

  return {
    start(id) {
      active[id] = {
        start: performance.now(),
        steps: []
      };
      console.log(`⏱️ [START][${id}] @ ${active[id].start.toFixed(3)}ms`);
    },

    step(id, label) {
      const p = active[id];
      if (!p) return; // ❗ IGNORAR steps sin start previo

      const now = performance.now();
      const diff = now - (p.steps.length ? p.steps[p.steps.length - 1].t : p.start);

      p.steps.push({ label, t: now });

      console.log(`⏱️ [STEP][${id}] +${diff.toFixed(3)}ms — ${label}`);
    },

    end(id, label = "END") {
      const p = active[id];
      if (!p) return;

      const now = performance.now();
      const total = now - p.start;

      console.log(`⏱️ [END][${id}] (${label}) — TOTAL ${total.toFixed(3)}ms`);
      console.log("   · steps:", p.steps);

      delete active[id];
    }
  };
})();
