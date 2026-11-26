// Builds dist-page/index.html: the whole app as one self-contained page
// (for hosts that serve a single HTML file, such as a claude.ai artifact).
//
// The app is built again here with every lazily loaded view inlined into one
// script (the site splits them into separate files, which a single page can't
// fetch). The TypeScript worker goes in <script type="text/plain"
// id="ts-worker-source" data-encoding="gzip-base64">, gzipped (about 1.4 MB
// instead of 4 MB); src/lib/ts/client.ts decompresses it and starts it from a
// blob: URL on the player's first key. Fonts load without blocking the page.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { build } from 'vite'

const out = 'dist-page'
const tmp = path.join(out, '.build')
await build({
  configFile: 'vite.config.ts',
  logLevel: 'warn',
  build: { outDir: tmp, emptyOutDir: true, rollupOptions: { output: { codeSplitting: false } } },
})
const dist = path.join(tmp, 'assets')
const files = fs.readdirSync(dist)
const read = (pick) => {
  const names = files.filter(pick)
  if (names.length !== 1) throw new Error(`Expected one build output for this in ${dist}, found: ${names.join(', ') || 'none'}`)
  return fs.readFileSync(path.join(dist, names[0]), 'utf8')
}
// "</script" would end the inline <script> early. Every occurrence in these
// bundles sits in a string, regex or comment, where "<\/script" means the same.
const safe = (js) => js.replace(/<\/script/gi, '<\\/script')

const css = read((f) => f.endsWith('.css'))
const app = safe(read((f) => f.startsWith('index-') && f.endsWith('.js')))
const worker = zlib.gzipSync(read((f) => f.startsWith('worker-') && f.endsWith('.js')), { level: 9 }).toString('base64')
// index.html's theme script, which applies the saved theme before the first paint.
const themeBoot = fs.readFileSync('index.html', 'utf8').match(/<script id="theme-boot">[\s\S]*?<\/script>/)?.[0]
if (!themeBoot) throw new Error('index.html has no <script id="theme-boot">')
const fonts =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap'

// The charset comes first: inline scripts hold non-ASCII text (the cn package's tables), which breaks if read as another encoding.
const html = `<meta charset="utf-8">
<title>Syntype</title>
<meta name="claude:viewport-fit-sides" content="cover">
${themeBoot}
<link rel="preload" as="style" href="${fonts}" onload="this.onload = null; this.rel = 'stylesheet'">
<style>${css}</style>
<div id="root"></div>
<script type="module">${app}</script>
<script type="text/plain" id="ts-worker-source" data-encoding="gzip-base64">${worker}</script>
`
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'index.html'), html)
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`${out}/index.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`)
