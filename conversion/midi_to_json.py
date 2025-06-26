# Requiere de pip install mido
#Clase para convertir archivos MIDI en JSON tomando el nombre de la nota (en su valor) 
#   y el tiempo en que comienza cada nota en ser presionada 
from mido import MidiFile
import json

mid = MidiFile('odeDifficult.midi') # Poner el archivo para hacer la conversión de MIDI -> JSON
events = [] # Arreglo donde vamos a poner todos los eventos MIDI
time = 0

# Extrae los eventos note_on con una velocidad mayor a 0, a un arreglo JSON
# En MIDI (colección de tracks) cada evento tiene información de 
    # Lo que está ocurriendo
    # El tiempo que pasó desde el último evento 
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
