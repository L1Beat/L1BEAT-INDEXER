import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  server: {
    proxy: {
      '^/.*\\.wasm$': {
        target: 'https://www.3dent.xyz',
        changeOrigin: true,
      },
      '^/.*\\.zkey$': {
        target: 'https://www.3dent.xyz',
        changeOrigin: true,
      },
    },
  },
})
