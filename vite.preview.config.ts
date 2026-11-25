import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The leaderboard preview (preview.html → dist-preview/), made into one
// self-contained page by scripts/build-preview.mjs for sharing as an artifact.
export default defineConfig({
  plugins: [react()],
  base: './',
  worker: { format: 'es' },
  build: { outDir: 'dist-preview', rollupOptions: { input: 'preview.html' } },
})
