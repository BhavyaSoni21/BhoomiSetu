import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Existing branding assets in public/ (see index.html). ponytail: reuses
      // shipped PNGs; dedicated 192/512 maskable icons are a hardening item.
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png', 'logo-icon.png'],
      manifest: {
        name: 'BhoomiSetu — Land Governance Platform',
        short_name: 'BhoomiSetu',
        description: 'GIS-based Land Governance & Cadastral Intelligence Platform',
        theme_color: '#1b4332',
        background_color: '#F7F6EE',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/logo-icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/bhoomisetu-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // Don't let the SW hijack API navigations.
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Raise from the 2 MiB default so the map bundle precaches.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // MVT tiles + basemap rasters: bounded CacheFirst.
            urlPattern: ({ url }) => /\/tiles\/.*\.pbf$/.test(url.pathname) || /\.(png|jpg|jpeg|webp)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'bhoomisetu-tiles',
              expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // API GET reads: NetworkFirst with cached fallback. Workbox routes
            // are GET-only by default, so mutations are never cached here —
            // they go through the explicit offline queue instead.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bhoomisetu-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Enabled so `virtual:pwa-register` resolves in the dev server too, not
      // just in `vite build`. registerType stays 'prompt', so the dev SW won't
      // auto-update tabs.
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  }
})
