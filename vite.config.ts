import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Use relative paths for Capacitor compatibility
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'logo.png'],
      workbox: {
        // Increase cache limit for WebLLM bundle (~6MB)
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        // Don't precache WebLLM chunk - it's loaded on-demand
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'webllm-models',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Kreativium',
        short_name: 'Kreativium',
        description: 'Advanced neuro-behavioral tracking and analysis',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Animation and UI libraries (recharts separated for lazy-loaded routes)
          'vendor-ui': ['framer-motion', 'lucide-react'],
          // Charts library - only loaded on chart-heavy routes
          'vendor-recharts': ['recharts'],
          // 3D/WebGL (largest dependency)
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          // Utilities (uuid removed - using native crypto.randomUUID)
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Three.js (~1MB) is large but loaded on-demand
    chunkSizeWarningLimit: 2000,
  },
})
