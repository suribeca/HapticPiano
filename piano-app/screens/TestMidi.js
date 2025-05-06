import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const htmlContent = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: sans-serif; padding: 20px; }
      #status { margin-top: 20px; font-weight: bold; }
    </style>
  </head>
  <body>
    <h2>Conectividad MIDI</h2>
    <p id="status">Esperando conexión de dispositivo MIDI...</p>

    <script>
      if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then((midiAccess) => {
          const inputs = midiAccess.inputs.values();
          let found = false;
          for (let input of inputs) {
            found = true;
            document.getElementById('status').innerHTML += '<br>🎹 Dispositivo detectado: ' + input.name;
            input.onmidimessage = (msg) => {
              document.getElementById('status').innerHTML += '<br>🎵 Nota recibida: ' + msg.data;
            };
          }
          if (!found) {
            document.getElementById('status').innerHTML += '<br>❌ No se detectaron entradas MIDI activas.';
          }
        }, () => {
          document.getElementById('status').innerHTML = '⚠️ No se pudo acceder al dispositivo MIDI.';
        });
      } else {
        document.getElementById('status').innerHTML = '❌ WebMIDI no es soportado en este navegador.';
      }
    </script>
  </body>
  </html>
`;

export default function TestMidi() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pantalla de prueba MIDI 🎹</Text>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={{ width: Dimensions.get('window').width, height: 400 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    marginBottom: 10,
  },
});