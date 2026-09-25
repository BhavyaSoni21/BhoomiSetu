import React from 'react';
import ReactDOM from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';
import { initTheme } from './theme/theme';
import { LanguageProvider } from './context/LanguageContext';
import { queryClient, persistOptions } from './offline/persist';
import { startNetworkMonitor } from './offline/network';
import './features/pwa/usePwaInstall'; // capture beforeinstallprompt at startup, before the footer mounts

initTheme();
startNetworkMonitor();

// autoUpdate (vite.config.ts): the new SW self-activates on next load. No
// confirm() gate — a suppressed confirm (tab not focused) used to strand users
// on a stale, cache-poisoned SW.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
