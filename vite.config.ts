import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'

/**
 * npm run report:bundle sets ANALYZE: each bundle then also writes a treemap (.html) and its
 * raw data (.json) to .visual/bundle/, with gzip and Brotli sizes measured from source maps
 * (what's left after minifying and tree shaking). Normal builds never load it.
 */
export function analyze(name: string): PluginOption[] {
  if (!process.env.ANALYZE) return []
  const options = { gzipSize: true, brotliSize: true, sourcemap: true, title: `Syntype bundle: ${name}` }
  return [
    visualizer({ ...options, filename: `.visual/bundle/${name}.html`, template: 'treemap' }),
    visualizer({ ...options, filename: `.visual/bundle/${name}.json`, template: 'raw-data' }),
  ]
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...analyze('app')],
  // Relative asset URLs, so the build (and its worker) works from any folder.
  base: './',
  worker: { format: 'es', plugins: () => analyze('worker') },
  build: { sourcemap: !!process.env.ANALYZE },
  // npm run bench:renders builds with React's profiling build, so <RenderMark>s record render times.
  resolve: {
    alias: {
      // shadcn components import from @/ (components.json).
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...(process.env.PROFILE ? { 'react-dom/client': 'react-dom/profiling' } : {}),
    },
  },
})
