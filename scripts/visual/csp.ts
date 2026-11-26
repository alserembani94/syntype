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

const PAGES = ['/', '/python', '/runs', '/leaderboard', '/privacy', '/fair-play', '/admin']

const root = process.cwd()
if (!process.argv.includes('--no-build')) build(root)
const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
const violations: string[] = []
try {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(`${page.url()}: ${m.text()}`)
  })
  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' })
    const csp = res?.headers()['content-security-policy']
    if (!csp) violations.push(`${path}: served without a Content-Security-Policy header`)
    // Violations seen by the page itself, including ones the console may not show.
    const seen = await page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const found: string[] = []
          document.addEventListener('securitypolicyviolation', (e) => found.push(`${e.violatedDirective} ${e.blockedURI}`))
          setTimeout(() => resolve(found), 500)
        }),
    )
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
