/**
 * npm run bench:renders [-- --label <name>]
 *
 * Which parts of the typing screen render while typing, and for how long.
 * Builds with React's profiling build (PROFILE=1, vite.config.ts), types 200
 * keys of the longest snippet at 4× CPU slowdown, and reads the times the
 * <RenderMark> regions record (src/lib/renderMark.tsx). Fails if the header or
 * the settings row renders at all: while typing, only the editor and status
 * bar should (CLAUDE.md, Performance). The profiling build goes into dist/,
 * and the normal build is restored afterwards, pass or fail.
 * Writes .visual/renders-<label>.json.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { BASE, OUT_DIR } from './config'
import { build, startServer } from './server'

const args = process.argv.slice(2)
const label = args.includes('--label') ? args[args.indexOf('--label') + 1] : 'current'
const KEYS = 200
/** Regions that must not render while typing. */
const STILL = ['header', 'settings']
const root = process.cwd()

process.env.PROFILE = '1'
let report: Record<string, { renders: number; msPerKey: number }> = {}
try {
  build(root)
  const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
  const browser = await chromium.launch()
  try {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } })
    await ctx.addInitScript(() => localStorage.setItem('syntype:autocomplete', 'false'))
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await page.goto(`${BASE}/leaderboard?lang=cobol&length=long&snippet=customer_report.cbl`)
    await page.getByRole('button', { name: 'Type this snippet' }).click()
    await page.locator('.editor').waitFor()
    await page.waitForTimeout(500)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    const recorded = await page.evaluate(async (n) => {
      const w = window as unknown as { __renders: [string, number][] }
      w.__renders = []
      const yieldNow = () =>
        new Promise<void>((r) => {
          const ch = new MessageChannel()
          ch.port1.onmessage = () => r()
          ch.port2.postMessage(0)
        })
      for (let i = 0; i < n; i++) {
        const t = document.querySelector('.code .cur')?.textContent
        document.dispatchEvent(new KeyboardEvent('keydown', { key: t === '↵' ? 'Enter' : (t ?? ''), bubbles: true, cancelable: true }))
        await yieldNow()
      }
      return w.__renders
    }, KEYS)
    for (const [id, ms] of recorded) {
      report[id] ??= { renders: 0, msPerKey: 0 }
      report[id].renders++
      report[id].msPerKey += ms / KEYS
    }
    report = Object.fromEntries(Object.entries(report).map(([id, r]) => [id, { renders: r.renders, msPerKey: Number(r.msPerKey.toFixed(3)) }]))
  } finally {
    await browser.close()
    await server.stop()
  }
} finally {
  delete process.env.PROFILE
  build(root)
}

mkdirSync(resolve(root, OUT_DIR), { recursive: true })
writeFileSync(resolve(root, OUT_DIR, `renders-${label}.json`), JSON.stringify(report, null, 1))
for (const id of ['app', 'editor', 'header', 'settings']) console.log(`${id.padEnd(9)} ${String(report[id]?.renders ?? 0).padStart(4)} renders  ${(report[id]?.msPerKey ?? 0).toFixed(3)} ms/key`)
const noisy = STILL.filter((id) => (report[id]?.renders ?? 0) > 0)
if (noisy.length) {
  console.error(`${noisy.join(' and ')} rendered while typing; only the editor and status bar should.`)
  process.exitCode = 1
}
