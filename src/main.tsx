import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import { initializeNativeMobile } from './services/nativeInit';
import { recoverFromVitePreloadError } from './services/moduleLoadRecovery';
import './styles/index.css';

const appEntrypoint = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src
  ?? window.location.pathname;

window.addEventListener('vite:preloadError', (event) => {
  try {
    recoverFromVitePreloadError(event, appEntrypoint, window.sessionStorage, () => {
      window.location.reload();
    });
  } catch {
    // Keep the original import failure visible if browser storage is unavailable.
  }
});

// Initialize native mobile features (Status bar, notifications, splash)
initializeNativeMobile();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
