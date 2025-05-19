import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Home from './pages/Home';
import Practica from './pages/Practica';
import { Piano } from './components/Piano';

function App() {
  return (
    <Router>
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/demo" component={Piano} />
        <Route path="/practica" component={Practica} />
      </Switch>
    </Router>
  );
}

export default App;
