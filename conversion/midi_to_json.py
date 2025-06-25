from mido import MidiFile
import json

mid = MidiFile('odeDifficult.midi')
events = []
time = 0

for track in mid.tracks:
    for msg in track:
        time += msg.time
        if msg.type == 'note_on' and msg.velocity > 0:
            events.append({
                'note': msg.note,
                'time': round(time / mid.ticks_per_beat, 2)  # tiempo en beats
            })

with open('notes.json', 'w') as f:
    json.dump(events, f)
