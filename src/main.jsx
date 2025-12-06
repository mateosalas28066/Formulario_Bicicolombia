import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const container = document.getElementById('bicicolombia-form-root') || document.getElementById('root');

if (!container) {
  console.warn('Bicicolombia form: no se encontró el contenedor raíz en la página.');
} else {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
