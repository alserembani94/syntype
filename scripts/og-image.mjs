// Renders the link preview image (public/og.png, 1200 × 630) from
// scripts/og/og.html, and the home screen icon (public/apple-touch-icon.png,
// 180 × 180) from public/favicon.svg. Needs Playwright with Chromium
// (npx playwright install chromium). Run it again after adding a language:
// node scripts/og-image.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// require() also finds a Playwright installed outside the project.
const { chromium } = createRequire(import.meta.url)('playwright')

const languages = fs.readdirSync('src/languages').filter((d) => fs.existsSync(path.join('src/languages', d, 'index.ts'))).length
const html = fs.readFileSync('scripts/og/og.html', 'utf8').replaceAll('{{LANGUAGES}}', String(languages))
const tmp = path.resolve('scripts/og/.render.html')
fs.writeFileSync(tmp, html)

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(tmp).href)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: 'public/og.png' })

  const icon = await browser.newPage({ viewport: { width: 180, height: 180 } })
  const svg = fs.readFileSync('public/favicon.svg', 'utf8')
  await icon.setContent(`<style>html,body{margin:0}svg{display:block;width:180px;height:180px}</style>${svg}`)
  await icon.screenshot({ path: 'public/apple-touch-icon.png' })
} finally {
  await browser.close()
  fs.rmSync(tmp, { force: true })
}
console.log(`public/og.png (${languages} languages), public/apple-touch-icon.png`)
