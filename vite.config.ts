import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset URLs, so the build (and its worker) works from any folder.
  base: './',
  worker: { format: 'es' },
  // npm run bench:renders builds with React's profiling build, so <RenderMark>s record render times.
  resolve: process.env.PROFILE ? { alias: { 'react-dom/client': 'react-dom/profiling' } } : undefined,
})
