import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        includeAssets: [
          'assets/aistudio/Icono_86bb4792.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        workbox: {
          maximumFileSizeToCacheInBytes: 6000000, // 6MB max precache entry size
          globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
          globIgnores: ['**/favicon.*', '**/apple-touch-icon.*', '**/manifest.webmanifest', '**/audio/**'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [
            /^\/api/,
            /^\/assets\//,
            /^\/src\//,
            /^\/@/,
            /^\/favicon\.(ico|png)/,
            /^\/apple-touch-icon\.png/,
            /^\/manifest\.webmanifest/,
          ],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // Navigation requests (App launch & Page load): NetworkFirst guarantees latest index.html matching current hashed JS chunks while keeping offline resilience
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'hmi-pages-shell',
                networkTimeoutSeconds: 2,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [200],
                },
              },
            },
            {
              // Images & Fonts (hashed JS/CSS are already version-managed cleanly by Workbox precache)
              urlPattern: ({ request }) => 
                request.destination === 'image' ||
                request.destination === 'font',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'hmi-assets-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts Stylesheets
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Google Fonts Webfonts
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Internal API calls: NetworkFirst with 1s timeout, then offline cache
              urlPattern: /\/api\/(patients|beds|historias|tasks|events)/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'hmi-api-cache',
                networkTimeoutSeconds: 1,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              // Ambient studio audio MP3s per SeasonalStyle: CacheFirst for instant playback & offline support
              urlPattern: /\/audio\/.*\.mp3$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'hmi-ambient-audio-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    build: {
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('pdfjs-dist')) return 'vendor-pdf';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR and file watching are disabled to prevent flickering and WebSocket errors during agent edits.
      hmr: false,
      watch: null as unknown as undefined,
    },
  };
});
