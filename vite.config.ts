import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin, type PluginOption } from 'vite'
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

/**
 * `import list from './snippets.txt?index'`: a language's snippets without their text (name and
 * length), read at build time. The language catalog (src/languages/catalog.ts) lists them in
 * the first load; the text loads with the language. Mirrors parseSnippets()
 * (src/languages/snippets.ts), which can't be imported here; catalog.test.ts checks they agree.
 */
export function snippetIndex(): Plugin {
  return {
    name: 'syntype-snippet-index',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith('snippets.txt?index')) return
      const file = id.slice(0, -'?index'.length)
      this.addWatchFile(file)
      const list = readFileSync(file, 'utf8')
        .split(/^=== /m)
        .filter((block) => block.trim())
        .map((block) => {
          const nl = block.indexOf('\n')
          const n = block.slice(nl + 1).replace(/\s+$/, '').length
          return { name: block.slice(0, nl).trim(), length: n < 120 ? 'short' : n <= 300 ? 'medium' : 'long' }
        })
      return `export default ${JSON.stringify(list)}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), snippetIndex(), ...analyze('app')],
  // Relative asset URLs, so the build (and its worker) works from any folder.
  base: './',
  worker: { format: 'es', plugins: () => analyze('worker') },
  // The manifest maps each language to its file, for the preloads scripts/build-pages.mjs writes (it deletes the manifest after).
  build: { sourcemap: !!process.env.ANALYZE, manifest: true },
  // npm run bench:renders builds with React's profiling build, so <RenderMark>s record render times.
  resolve: {
    alias: {
      // shadcn components import from @/ (components.json).
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      ...(process.env.PROFILE ? { 'react-dom/client': 'react-dom/profiling' } : {}),
    },
  },
})
