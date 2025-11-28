import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import BiciAgenda from './BiciTallerApp';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BiciAgenda />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
