import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs, so the build (and its worker) works from any folder.
  base: './',
  worker: { format: 'es' },
})
