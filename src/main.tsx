import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/slide-canvas.css';
import './styles/infographics.css';
import './themes/tokens.css';
import { registerSW } from './pwa/registerSW';

registerSW();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
