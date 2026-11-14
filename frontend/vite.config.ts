import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const frontendPort = parseInt(env.VITE_PORT || env.PORT || '5173', 10)
  const backendPort = env.VITE_BACKEND_PORT || '5001'
  const backendHost = env.VITE_BACKEND_HOST || '127.0.0.1'
  const backendUrl = env.VITE_BACKEND_URL || `http://${backendHost}:${backendPort}`

  return {
    base: './',
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: frontendPort,
    },
    build: {
      target: 'esnext',
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('three')) {
                return 'vendor-three';
              }
              if (id.includes('gsap')) {
                return 'vendor-gsap';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              return 'vendor-libs';
            }
          },
        },
      },
    },
  }
})
