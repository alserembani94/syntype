import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset URLs, so the build (and its worker) works from any folder.
  base: './',
  worker: { format: 'es' },
  // npm run bench:renders builds with React's profiling build, so <RenderMark>s record render times.
  resolve: {
    alias: {
      // shadcn components import from @/ (components.json).
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...(process.env.PROFILE ? { 'react-dom/client': 'react-dom/profiling' } : {}),
    },
  },
})
