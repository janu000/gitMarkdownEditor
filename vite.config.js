import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'

// Custom Vite plugin to write ONLY the latest state/error to debug.log
function agentDebugPlugin() {
  return {
    name: 'agent-debug-logger',
    configureServer(server) {
      fs.writeFileSync('debug.log', 'Server started successfully.\n');

      const originalSend = server.ws.send;
      server.ws.send = function (payload) {
        if (payload.type === 'error') {
          // Overwrite file with the raw, clean error details
          const errorText = `ERROR ENCOUNTERED:\nMessage: ${payload.err.message}\nFile: ${payload.err.id || 'Unknown'}\n\nCode Frame:\n${payload.err.frame || ''}`;
          fs.writeFileSync('debug.log', errorText);
        } else if (payload.type === 'update' || payload.type === 'full-reload') {
          // Reset the file when you fix an error and it recompiles
          fs.writeFileSync('debug.log', 'App compiled successfully. No current errors.\n');
        }
        originalSend.apply(this, arguments);
      };
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  // 👇 ADD THIS SERVER BLOCK 👇
  // server: {
  //   host: true, // This allows connections from outside localhost (like your Docker container)
  //   port: 5173, // Keep the default Vite port explicit
  // },
  // 👆 ---------------------- 👆
  plugins: [
    react(),
    agentDebugPlugin(), // Add our custom logging plugin here
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
            src: '/vite.svg', // Using vite.svg as a placeholder
            sizes: 'any',
            type: 'image/svg+xml',
          },
          // {
          //   src: 'pwa-192x192.png',
          //   sizes: '192x192',
          //   type: 'image/png'
          // },
          // {
          //   src: 'pwa-512x512.png',
          //   sizes: '512x512',
          //   type: 'image/png'
          // },
          // {
          //   src: 'pwa-512x512.png',
          //   sizes: '512x512',
          //   type: 'image/png',
          //   purpose: 'any maskable'
          // }
        ]
      },
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,ts,jsx,tsx}']
      }
    })
  ],
})