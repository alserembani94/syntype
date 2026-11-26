// Builds dist-gallery/index.html: the design system gallery (src/gallery) as
// one self-contained page, published as an artifact for review. The live
// copy is /admin/gallery (vite.admin.config.ts).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const out = 'dist-gallery'
const tmp = path.join(out, '.build')
// Its own config, as vite.admin.config.ts but with the gallery as the only input, in one file.
await build({
  configFile: false,
  logLevel: 'warn',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  build: { minify: process.env.NO_MINIFY ? false : undefined, outDir: tmp, emptyOutDir: true, assetsDir: 'assets', rollupOptions: { input: 'admin/gallery.html', output: { codeSplitting: false } } },
})
const dist = path.join(tmp, 'assets')
const files = fs.readdirSync(dist)
const read = (pick) => {
  const names = files.filter(pick)
  if (names.length !== 1) throw new Error(`Expected one build output for this in ${dist}, found: ${names.join(', ') || 'none'}`)
  return fs.readFileSync(path.join(dist, names[0]), 'utf8')
}
const css = read((f) => f.endsWith('.css'))
const js = read((f) => f.endsWith('.js')).replace(/<\/script/gi, '<\\/script')
const page = fs.readFileSync('admin/gallery.html', 'utf8')
const themeBoot = page.match(/<script id="theme-boot">[\s\S]*?<\/script>/)?.[0]
if (!themeBoot) throw new Error('admin/gallery.html has no <script id="theme-boot">')
const fonts =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap'
const html = `<meta charset="utf-8">
<title>Syntype Gallery</title>
<meta name="claude:viewport-fit-sides" content="cover">
${themeBoot}
<link rel="preload" as="style" href="${fonts}" onload="this.onload = null; this.rel = 'stylesheet'">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
fs.writeFileSync(path.join(out, 'index.html'), html)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`${out}/index.html: ${(html.length / 1024).toFixed(0)} KB`)
