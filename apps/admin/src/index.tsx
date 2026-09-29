import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/main.css';

// Registra o Service Worker para PWA Offline-First & Auto-Atualizações em Background
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('PWA ServiceWorker registrado com sucesso:', registration.scope);
      },
      (err) => {
        console.warn('Falha no registro do PWA ServiceWorker:', err);
      }
    );
  });
}

const container = document.getElementById('root');
if (container === null) {
  throw new Error('GeoNexo: element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
