// Builds dist-page/index.html: the whole app as one self-contained page
// (for hosts that serve a single HTML file, such as a claude.ai artifact).
// CSS, JS and the TypeScript worker are inlined; the worker goes in
// <script type="text/plain" id="ts-worker-source">, which src/lib/ts/client.ts
// starts from a blob: URL. Run `npm run build` first.
import fs from 'node:fs'
import path from 'node:path'

const dist = 'dist/assets'
const out = 'dist-page'
const files = fs.readdirSync(dist)
const read = (pick) => {
  const name = files.find(pick)
  if (!name) throw new Error(`Missing build output in ${dist}; run npm run build first.`)
  return fs.readFileSync(path.join(dist, name), 'utf8')
}
// "</script" would end the inline <script> early. Every occurrence in these
// bundles sits in a string, regex or comment, where "<\/script" means the same.
const safe = (js) => js.replace(/<\/script/gi, '<\\/script')

const css = read((f) => f.endsWith('.css'))
const app = safe(read((f) => f.startsWith('index-') && f.endsWith('.js')))
const worker = safe(read((f) => f.startsWith('worker-') && f.endsWith('.js')))
// index.html's theme script, which applies the saved theme before the first paint.
const themeBoot = fs.readFileSync('index.html', 'utf8').match(/<script id="theme-boot">[\s\S]*?<\/script>/)?.[0]
if (!themeBoot) throw new Error('index.html has no <script id="theme-boot">')
const fonts =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap'

const html = `<title>Syntype</title>
<meta name="claude:viewport-fit-sides" content="cover">
${themeBoot}
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<script type="text/plain" id="ts-worker-source">${worker}</script>
<script type="module">${app}</script>
`
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'index.html'), html)
console.log(`${out}/index.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`)
