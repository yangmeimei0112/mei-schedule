import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Register PWA Service Worker only in production web/https contexts (skip file:// Electron loads)
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  window.location.protocol !== 'file:'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Optional in offline/restricted environments
    });
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
