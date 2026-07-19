import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 38'],
    })
  ],
  base: './',
  server: {
    proxy: {
      '/api/gql': {
        target: 'https://sv1.fluxcedene.net',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
