import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import './styles/design-system.css';
import App from './App';
import { LanguageProvider } from './context/LanguageContext';
import { installChunkLoadRecovery } from './utils/chunkLoadRecovery';

installChunkLoadRecovery();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
