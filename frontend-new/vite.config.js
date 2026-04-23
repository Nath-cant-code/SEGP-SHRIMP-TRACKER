import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api/* → backend so the browser never makes a cross-origin request.
    // This eliminates CORS issues in development completely.
    proxy: {
      '/analyze': 'http://127.0.0.1:8000',
      '/models':  'http://127.0.0.1:8000',
      '/results': 'http://127.0.0.1:8000',
      '/health':  'http://127.0.0.1:8000',
    },
  },
})