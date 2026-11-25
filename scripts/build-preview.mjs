// Builds dist-preview/leaderboard.html: the leaderboard preview (src/preview)
// as one self-contained page, CSS and JS inlined, for sharing as an artifact.
// Run `npx vite build --config vite.preview.config.ts` first (npm run build:preview).
import fs from 'node:fs'
import path from 'node:path'

const dir = 'dist-preview/assets'
const files = fs.readdirSync(dir)
const read = (pick) => {
  const name = files.find(pick)
  if (!name) throw new Error(`Missing build output in ${dir}`)
  return fs.readFileSync(path.join(dir, name), 'utf8')
}
const safe = (js) => js.replace(/<\/script/gi, '<\\/script')
const css = read((f) => f.endsWith('.css'))
const js = safe(read((f) => f.startsWith('preview-') && f.endsWith('.js')))
const fonts =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap'
const html = `<meta charset="utf-8">
<title>Syntype Leaderboard Preview</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`
fs.writeFileSync('dist-preview/leaderboard.html', html)
console.log(`dist-preview/leaderboard.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`)
