import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initRuntimeErrorBuffer } from './utils/runtimeErrorBuffer';
import './index.css';

initRuntimeErrorBuffer();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
