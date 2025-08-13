import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { apiPlugin } from './vite-plugin-api'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    apiPlugin(),
  ],
})
