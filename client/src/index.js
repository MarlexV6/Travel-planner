import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css'; // ← ДОЛЖНО БЫТЬ ПЕРВЫМ
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

console.log('REACT_APP_GOOGLE_MAPS_API_KEY:', process.env.REACT_APP_GOOGLE_MAPS_API_KEY ? '✓ Set' : '✗ Not set');
console.log('REACT_APP_API_URL:', process.env.REACT_APP_API_URL);


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();