import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { PLATFORM_NAME } from './config/branding';

document.title = PLATFORM_NAME;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
