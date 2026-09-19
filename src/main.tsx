import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { PenyediaAuth } from './context/AuthContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PenyediaAuth>
        <App />
      </PenyediaAuth>
    </BrowserRouter>
  </StrictMode>
);
