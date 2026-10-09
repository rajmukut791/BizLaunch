import { Toaster } from 'react-hot-toast';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './animated.css';
import './pages/Extended.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: { background: '#203f32', color: '#fff', borderRadius: '14px' },
        duration: 4500,
      }}
    />
  </StrictMode>,
);
