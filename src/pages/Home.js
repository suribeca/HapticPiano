import React from 'react';
import { Link } from 'react-router-dom';

function Home() {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>🎹 Piano Háptico</h1>
      <Link to="/demo"><button>Ir a la Demo</button></Link>
      <br /><br />
      <Link to="/practica"><button>Practicar Canciones</button></Link>
    </div>
  );
}

export default Home;