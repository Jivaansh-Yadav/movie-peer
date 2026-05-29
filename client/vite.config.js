import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const rootNodeModules = (path) => fileURLToPath(new URL(`../node_modules/${path}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react\/jsx-runtime$/, replacement: rootNodeModules('react/jsx-runtime.js') },
      { find: /^react-dom\/client$/, replacement: rootNodeModules('react-dom/client.js') },
      { find: /^react-dom$/, replacement: rootNodeModules('react-dom/index.js') },
      { find: /^react$/, replacement: rootNodeModules('react/index.js') }
    ]
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/stream': 'http://localhost:3000',
      '/subtitles': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    sourcemap: false,
    target: 'es2020'
  }
});
