import React from 'react';
import ReactDOM from 'react-dom/client';
import { OverlayWidget } from './components/OverlayWidget';
import './overlay.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OverlayWidget />
  </React.StrictMode>
);
