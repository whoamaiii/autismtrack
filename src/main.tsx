import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css';
import './i18n';
import App from './App.tsx';

// Register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  registerSW({
    onNeedRefresh() {
      if (import.meta.env.DEV) {
        console.log('New content available, refresh to update.')
      }
    },
    onOfflineReady() {
      if (import.meta.env.DEV) {
        console.log('App ready to work offline.')
      }
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
