/**
 * npm run bench:keys [-- <url>] [--label <name>]
 *
 * The cost of one keystroke in the real app: dispatch the key, let React
 * render and commit, force style and layout, and time it. 250 keys of the
 * longest snippet (COBOL, customer_report.cbl), at 1×, 4× and 6× CPU
 * slowdown. With no URL it builds and runs the local server; with one (the
 * live site) it measures that. Writes .visual/bench-<label>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { BASE, OUT_DIR } from './config'
import { build, startServer } from './server'

const args = process.argv.slice(2)
const url = args.find((a) => a.startsWith('http'))
const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : url ? new URL(url).host : 'local'
const KEYS = 250
const RATES = [1, 4, 6]
const SNIPPET = '/leaderboard?lang=cobol&length=long&snippet=customer_report.cbl'
const root = process.cwd()

let server: { stop: () => Promise<void> } | undefined
if (!url) {
  if (!args.includes('--no-build')) build(root)
  server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
}
const base = url ?? BASE
const browser = await chromium.launch()
const out: Record<string, { keys: number; median: number; p95: number; max: number }> = {}
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  await ctx.addInitScript(() => localStorage.setItem('syntype:autocomplete', 'false'))
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  for (const rate of RATES) {
    await page.goto(base + SNIPPET)
    await page.getByRole('button', { name: 'Type this snippet' }).click()
    await page.locator('.editor').waitFor()
    await page.waitForTimeout(500)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate })
    const times = await page.evaluate(async (n) => {
      const yieldNow = () => new Promise<void>((r) => {
        const ch = new MessageChannel()
        ch.port1.onmessage = () => r()
        ch.port2.postMessage(0)
      })
      const ts: number[] = []
      for (let i = 0; i < n; i++) {
        const cur = document.querySelector('.code .cur')
        if (!cur) break
        const t = cur.textContent
        const t0 = performance.now()
        document.dispatchEvent(new KeyboardEvent('keydown', { key: t === '↵' ? 'Enter' : (t ?? ''), bubbles: true, cancelable: true }))
        await yieldNow()
        document.body.getBoundingClientRect()
        void (document.querySelector('.code .cur') as HTMLElement | null)?.offsetTop
        ts.push(performance.now() - t0)
      }
      return ts
    }, KEYS)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
    times.sort((a, b) => a - b)
    const q = (x: number) => Number(times[Math.min(times.length - 1, Math.floor(times.length * x))].toFixed(2))
    out[`${rate}x`] = { keys: times.length, median: q(0.5), p95: q(0.95), max: Number(times.at(-1)!.toFixed(1)) }
  }
} finally {
  await browser.close()
  await server?.stop()
}
mkdirSync(resolve(root, OUT_DIR), { recursive: true })
writeFileSync(resolve(root, OUT_DIR, `bench-${label}.json`), JSON.stringify(out, null, 1))
console.log(label, Object.entries(out).map(([r, v]) => `${r}: median ${v.median} ms, p95 ${v.p95} ms`).join(' · '))
