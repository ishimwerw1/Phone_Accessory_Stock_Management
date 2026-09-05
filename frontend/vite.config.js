import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['company-logo.png', 'logo.svg', 'favicon.svg', 'icons.svg', 'favicon.ico', 'favicon-32x32.png'],
      manifest: {
        name: 'Nsenga Legacy Electronic',
        short_name: 'Nsenga Legacy Electronic',
        description: 'Manage phone spare parts, screens, batteries, boards, chargers, suppliers, customers, sales and loans.',
        theme_color: '#0d3b66',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity', 'finance'],
        lang: 'en',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/company-logo.png',
            sizes: 'any',
            type: 'image/png',
          },
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'View the overview dashboard',
            url: '/',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'New Sale',
            short_name: 'New Sale',
            description: 'Record a new sale',
            url: '/sales/new',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Customers',
            short_name: 'Customers',
            description: 'Customer list and accounts',
            url: '/customers',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Products',
            short_name: 'Products',
            description: 'Product catalogue',
            url: '/products',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets-cache',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: ({ url, request }) => {
              if (request.mode !== 'cors') return false
              return url.pathname.startsWith('/api/')
            },
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation-cache',
              networkTimeoutSeconds: 8,
              plugins: [
                {
                  cacheWillUpdate: async ({ response }) => {
                    if (response && response.type === 'opaqueredirect') return response
                    return response
                  },
                },
              ],
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
})
