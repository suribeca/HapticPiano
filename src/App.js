import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Practica from './pages/Practica';
import { Piano } from './components/Piano';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/demo" element={<Piano />} />
        <Route path="/practica" element={<Practica />} />
      </Routes>
    </Router>
  );
}

export default App;

