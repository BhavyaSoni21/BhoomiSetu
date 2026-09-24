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

// registerType:'prompt' — surface an update instead of silently swapping the SW
// mid-session (spec §31). Minimal confirm() until a themed toast is wired.
const updateSW = registerSW({
  onNeedRefresh() {
    if (window.confirm('A new version of BhoomiSetu is available. Reload now?')) void updateSW(true);
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
