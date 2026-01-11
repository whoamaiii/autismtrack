import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css';
import './i18n';
import App from './App.tsx';
import { runDataMigrations } from './store/dataMigration';

// Run data migrations before React renders
// This migrates legacy Norwegian strings to i18n keys
runDataMigrations();

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
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found. Ensure index.html contains <div id="root"></div>');
}
createRoot(rootElement).render(<App />)
