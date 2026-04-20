import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rewrite-index',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/public/index.html';
          }
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: 'public/index.html'
    }
  }
})
