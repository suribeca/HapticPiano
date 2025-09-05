# Requiere: pip install mido
# Uso: python midi_to_json.py  (ajusta el nombre del MIDI si quieres)
#
# Qué hace:
# - Lee un MIDI
# - Toma todos los "note_on" (velocity > 0)
# - Convierte su tiempo acumulado de ticks a beats
# - Normaliza para que el primer note_on quede exactamente en el beat 2.0
# - Exporta a notes.json con {"note": N, "time": beat}

from mido import MidiFile
import json

MIDI_IN = 'odeDificil.midi'     
JSON_OUT = 'notes.json'
START_BEAT = 1.5             # Queremos que la primera nota quede aquí

mid = MidiFile(MIDI_IN)

events = []       # guardaremos tiempos en beats *sin* normalizar primero
abs_ticks = 0     # acumulador de ticks absolutos

# 1) Recorremos todos los tracks y juntamos sus note_on en una sola línea temporal
for track in mid.tracks:
    abs_ticks = 0
    for msg in track:
        abs_ticks += msg.time
        if msg.type == 'note_on' and msg.velocity > 0:
            # ticks -> beats
            beat_time = abs_ticks / mid.ticks_per_beat
            events.append({'note': msg.note, 'time': beat_time})

# 2) Si no hay eventos, salimos
if not events:
    with open(JSON_OUT, 'w') as f:
        json.dump([], f)
    print("No se encontraron notas. Se generó un JSON vacío.")
    raise SystemExit

# 3) Normalizamos: primer beat observado -> START_BEAT
first_beat = min(e['time'] for e in events)  # primer evento en beats
normalized = []
for e in events:
    new_time = (e['time'] - first_beat) + START_BEAT
    normalized.append({'note': e['note'], 'time': round(new_time, 2)})

# 4) Exportamos
with open(JSON_OUT, 'w') as f:
    json.dump(normalized, f, indent=2)

print(f"✅ Generado {JSON_OUT} con {len(normalized)} notas. Primer beat = {START_BEAT}.")