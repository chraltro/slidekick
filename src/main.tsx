import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles/globals.css';
import './styles/slide-canvas.css';
import './styles/infographics.css';
import './themes/tokens.css';
import { registerSW } from './pwa/registerSW';

registerSW();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={(error) => (
        <div style={{ padding: '2rem', color: '#e4e4ea', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#a1a1aa', marginBottom: '1rem' }}>
            {error.message} (your deck is autosaved in this browser)
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid #3f3f46',
              background: '#27272a',
              color: '#e4e4ea',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      )}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
