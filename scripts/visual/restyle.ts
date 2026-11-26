/**
 * npm run bench:restyle [-- --no-build] [--label <name>]
 *
 * How much style work one keystroke causes, counted rather than timed: the
 * number of elements Chrome restyles (UpdateLayoutTree's elementCount, from a
 * trace) and its total style time, over 100 keys of the longest snippet. The
 * count is exact and repeatable, so a CSS change that makes typing restyle
 * more of the page shows up even when bench:keys's timings are too noisy.
 * Also reports the time spent handling each keydown (all listeners), unthrottled.
 */
import { chromium } from 'playwright'
import { join } from 'node:path'
import { BASE } from './config'
import { build, startServer } from './server'

const args = process.argv.slice(2)
const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : 'local'
const KEYS = 100
const SNIPPET = '/leaderboard?lang=cobol&length=long&snippet=customer_report.cbl'
const root = process.cwd()
if (!args.includes('--no-build')) build(root)
const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('syntype:autocomplete', 'false'))
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await page.goto(BASE + SNIPPET)
  await page.getByRole('button', { name: 'Type this snippet' }).click()
  await page.locator('.editor').waitFor()
  await page.waitForTimeout(800)
  const events: { name: string; ph?: string; dur?: number; args?: { elementCount?: number; data?: { type?: string } } }[] = []
  // (Playwright's CDP types list only 'close'; the event is real.)
  ;(cdp as unknown as { on: (n: string, f: (e: { value: typeof events }) => void) => void }).on('Tracing.dataCollected', (e) => events.push(...e.value))
  const done = new Promise<void>((r) => (cdp as unknown as { once: (n: string, f: () => void) => void }).once('Tracing.tracingComplete', () => r()))
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' })
  await page.evaluate(async (n) => {
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    for (let i = 0; i < n; i++) {
      const t = document.querySelector('.code .cur')?.textContent
      if (t == null) break
      document.dispatchEvent(new KeyboardEvent('keydown', { key: t === '↵' ? 'Enter' : t, bubbles: true, cancelable: true }))
      await frame()
    }
  }, KEYS)
  await cdp.send('Tracing.end')
  await done
  const style = events.filter((e) => e.name === 'UpdateLayoutTree')
  const elements = style.reduce((s, e) => s + (e.args?.elementCount ?? 0), 0)
  const ms = style.reduce((s, e) => s + (e.dur ?? 0), 0) / 1000
  // Script run by the keystroke itself: the keydown dispatch (every listener, React's and others').
  const keydown = events.filter((e) => e.name === 'EventDispatch' && e.args?.data?.type === 'keydown')
  const scriptMs = keydown.reduce((s, e) => s + (e.dur ?? 0), 0) / 1000
  // Everything the main thread did while typing (top-level tasks), per key.
  const tasks = events.filter((e) => e.name === 'RunTask')
  const taskMs = tasks.reduce((s, e) => s + (e.dur ?? 0), 0) / 1000
  if (process.env.BREAKDOWN) {
    const by = new Map<string, number>()
    for (const e of events) if (e.dur) by.set(e.name === 'EventDispatch' ? `event:${e.args?.data?.type}` : e.name, (by.get(e.name === 'EventDispatch' ? `event:${e.args?.data?.type}` : e.name) ?? 0) + e.dur / 1000)
    console.log([...by].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([n, v]) => `${n}=${(v / KEYS).toFixed(3)}`).join(' '))
  }
  console.log(
    `${label}: main thread ${(taskMs / KEYS).toFixed(3)} ms per key; ${(elements / KEYS).toFixed(1)} elements restyled per key, ${(ms / KEYS).toFixed(3)} ms style per key (${style.length} recalcs); keydown handling ${(scriptMs / KEYS).toFixed(3)} ms per key`,
  )
} finally {
  await browser.close()
  await server.stop()
}
