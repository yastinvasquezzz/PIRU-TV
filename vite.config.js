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
      },
      '/primeload-proxy': {
        target: 'https://primeload.co',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/primeload-proxy/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['referrer-policy'];
            proxyRes.headers['access-control-allow-origin'] = '*';
          });
        }
      }
    }
  }
})
