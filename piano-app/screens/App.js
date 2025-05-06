import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';
import React from 'react';


export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenido a la App MIDI</Text>
      <Button
        title="Ir a prueba de piano MIDI"
        onPress={() => navigation.navigate('TestMidi')}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  }
});
