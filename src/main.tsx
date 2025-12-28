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

// NOTE: StrictMode disabled due to React 19 + Recharts 3.x compatibility issue
// Recharts internally uses Redux/Immer which conflicts with React 19's concurrent rendering
// Re-enable when Recharts fixes this: https://github.com/recharts/recharts/issues
createRoot(document.getElementById('root')!).render(<App />)
