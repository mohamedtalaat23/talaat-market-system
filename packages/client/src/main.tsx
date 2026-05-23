import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

// Import global styles — ORDER MATTERS:
// 1. variables.css — defines CSS custom properties
// 2. reset.css — normalizes browser defaults
// 3. globals.css — applies base styles using the variables
import './styles/variables.css';
import './styles/reset.css';
import './styles/globals.css';

/**
 * React entry point.
 *
 * StrictMode is enabled — it double-invokes certain lifecycle methods in
 * development to detect side effects. This catches bugs early.
 * It has NO effect in production builds.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'Root element #root not found. Check your index.html has <div id="root"></div>.',
  );
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
