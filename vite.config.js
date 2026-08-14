import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  worker: {
    format: 'es',
  },
  define: {
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  // 👇 ADD THIS SERVER BLOCK 👇
  server: {
    host: true, // This allows connections from outside localhost (like your Docker container)
    port: 5173, // Keep the default Vite port explicit
    allowedHosts: ['host.docker.internal'],
  },
  // 👆 ---------------------- 👆
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Git Markdown Editor',
        short_name: 'GitMD',
        description: 'A powerful, browser-based Markdown editor with GitHub integration.',
        theme_color: '#1a202c', // Dark blue-gray, similar to current dark theme
        background_color: '#0d1117', // Even darker, like GitHub background
        display: 'standalone',
        icons: [
          {
            src: '/logo.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ]
      },
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,ts,jsx,tsx,woff,woff2}']
      }
    })
  ],
})