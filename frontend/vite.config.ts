import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  build: {
    // Split heavy third-party libs into their own chunks so the initial
    // page load (Home) doesn't ship React Flow, Framer Motion, etc.
    // Vite 8 uses Rolldown — `advancedChunks.groups` is the supported API.
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'react-vendor', test: /node_modules\/(react|react-dom|react-router|react-router-dom)\// },
            { name: 'xyflow', test: /node_modules\/@xyflow\// },
            { name: 'motion', test: /node_modules\/framer-motion\// },
            { name: 'icons', test: /node_modules\/lucide-react\// },
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 6052,
    strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1'],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
