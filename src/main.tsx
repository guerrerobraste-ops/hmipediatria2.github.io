import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { readStoredSeasonalStyle } from './utils/seasonalTheme';
import { syncDynamicPwaIcons } from './utils/dynamicPwaIconSync';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { clearServiceWorkerCachesAndReload } from './utils/lazyWithRetry';

// Immediately sync browser tab favicon & PWA icons with stored seasonal style on startup
syncDynamicPwaIcons(readStoredSeasonalStyle());

// Recover cleanly if Vite fails to load a dynamic chunk after a deployment
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault();
    void clearServiceWorkerCachesAndReload();
  });
}

if (import.meta.env.DEV) {
  // Ensure dev preview never serves stale modules from a previously registered dev Service Worker
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      const hadRegs = regs.length > 0;
      Promise.all(regs.map(r => r.unregister())).then(() => {
        if ('caches' in window) {
          window.caches.keys().then(names => {
            Promise.all(names.map(name => window.caches.delete(name))).then(() => {
              if (hadRegs && !sessionStorage.getItem('hmi_dev_sw_cleaned')) {
                sessionStorage.setItem('hmi_dev_sw_cleaned', '1');
                window.location.reload();
              }
            });
          });
        }
      });
    }).catch(() => {});
  }
} else {
  // Register Service Worker for true offline resilience in production
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('🔄 HMI: Nueva versión disponible del sistema clínico.');
      void updateSW(true);
    },
    onOfflineReady() {
      console.log('⚡ HMI: Aplicación lista para funcionar 100% offline sin conexión.');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
