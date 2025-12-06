import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'icon.svg'],
      manifest: {
        name: 'NeuroLogg Pro',
        short_name: 'NeuroLogg',
        description: 'Advanced neuro-behavioral tracking and analysis',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
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
          // Animation and UI libraries
          'vendor-ui': ['framer-motion', 'lucide-react', 'recharts'],
          // 3D/WebGL (largest dependency)
          'vendor-three': ['three', '@react-three/fiber', '@react-three/drei'],
          // Utilities
          'vendor-utils': ['date-fns', 'uuid', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Three.js is ~1MB minified - unavoidable, but we only load it on desktop
    chunkSizeWarningLimit: 1100,
  },
})
