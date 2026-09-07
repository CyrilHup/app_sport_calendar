import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import { initializeNativeMobile } from './services/nativeInit';
import './styles/index.css';

// Initialize native mobile features (Status bar, notifications, splash)
initializeNativeMobile();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

