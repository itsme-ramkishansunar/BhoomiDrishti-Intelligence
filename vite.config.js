import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigin = String(
    process.env.BHOOMI_BACKEND_ORIGIN ||
    process.env.BACKEND_ORIGIN ||
    env.BHOOMI_BACKEND_ORIGIN ||
    env.BACKEND_ORIGIN ||
    `http://127.0.0.1:${process.env.BACKEND_PORT || env.BACKEND_PORT || 8787}`
  ).replace(/\/$/, '');

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            charts: ['recharts'],
            icons: ['lucide-react'],
            mapping: ['leaflet'],
            parser: ['papaparse'],
          },
        },
      },
    },
    server: {
      proxy: {
        '/api': { target: backendOrigin, changeOrigin: true },
      },
    },
  };
});
