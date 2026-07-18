import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2015',
    cssTarget: 'chrome68'
  },
  server: {
    proxy: {
      '/api/gql': {
        target: 'https://sv1.fluxcedene.net',
        changeOrigin: true,
        secure: true,
      }
    }
  }
});
