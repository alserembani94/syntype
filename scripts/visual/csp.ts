/**
 * npm run check:csp [-- --no-build]
 *
 * Opens every kind of built page on the local site, served with the real
 * Content Security Policy from public/_headers, and fails on any violation the
 * browser reports. Run it after any change to how styles or scripts are built
 * or loaded (CLAUDE.md, Security headers).
 */
import { chromium } from 'playwright'
import { join } from 'node:path'
import { BASE } from './config'
import { build, startServer } from './server'

const PAGES = ['/', '/python', '/runs', '/leaderboard', '/privacy', '/fair-play', '/admin', '/admin/gallery']

const root = process.cwd()
if (!process.argv.includes('--no-build')) build(root)
const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
const violations: string[] = []
try {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  // Record every violation from the first moment, with where it came from and a sample of what was blocked.
  await page.addInitScript(() => {
    const seen: string[] = []
    ;(window as unknown as { __csp: string[] }).__csp = seen
    document.addEventListener('securitypolicyviolation', (e) =>
      seen.push(`${e.violatedDirective} ${e.blockedURI || ''} at ${e.sourceFile || 'the page'}:${e.lineNumber}:${e.columnNumber} sample: ${e.sample || '(none)'}`),
    )
  })
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(`${page.url()}: ${m.text()}`)
  })
  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const csp = res?.headers()['content-security-policy']
    if (!csp) violations.push(`${path}: served without a Content-Security-Policy header`)
    // On the gallery, open a dialog too: React Aria adds a style element while an overlay locks scrolling.
    if (path === '/admin/gallery') {
      await page.getByRole('button', { name: 'Change name' }).click()
      await page.getByRole('dialog').waitFor()
    }
    // Violations seen by the page itself, with their source, including ones the console may not show.
    await page.waitForTimeout(500)
    const seen = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)
    violations.push(...seen.map((v) => `${path}: ${v}`))
  }
  await browser.close()
} finally {
  await server.stop()
}
if (violations.length) {
  console.log(violations.join('\n'))
  process.exitCode = 1
} else console.log(`${PAGES.length} pages, no Content Security Policy violations.`)
