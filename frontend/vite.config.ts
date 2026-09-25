import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate, not 'prompt': the prompt path gated SW activation behind a
      // window.confirm() (main.tsx), which the browser SILENTLY suppresses when
      // the tab isn't focused. A user then stayed pinned on an old, cache-
      // poisoned SW that replayed API reads as no-response/no-CORS forever. With
      // autoUpdate the fixed SW skipWaiting + clientsClaims on next load, no
      // click needed, so a bad SW can't strand a user.
      registerType: 'autoUpdate',
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
          // logo-icon.png is a real 512x512 PNG — it satisfies Chrome's
          // installability bar (needs a genuine >=512 icon). The old manifest
          // mislabeled it 192 and pointed the 512 slot at a 163px file, so the
          // app was never installable and beforeinstallprompt never fired.
          { src: '/logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/logo-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
            // API GET reads: NetworkFirst with cached fallback. SAME-ORIGIN
            // ONLY — in production the API is a different origin (onrender), and
            // routing those auth'd cross-origin reads through the SW made
            // workbox swallow them into `no-response` errors with no CORS header
            // (browser then blamed CORS). Cross-origin API now bypasses the SW
            // and hits the network directly, where CORS works.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              // Bumped -v2 to abandon any status-0 (opaque failure) entries the
              // old rule poisoned this cache with.
              cacheName: 'bhoomisetu-api-v2',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
              // Only cache real successes — never opaque/failed (status 0)
              // responses, which replay forever as broken.
              cacheableResponse: { statuses: [200] },
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
      // just in `vite build`.
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  build: {
    // MapLibre GL (~880 KB) is already isolated in its own lazy chunk that
    // only loads when the map opens, so it's off the initial path. Raise the
    // warning threshold above it rather than chase manualChunks for a chunk
    // that's already correctly deferred.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
  }
})
