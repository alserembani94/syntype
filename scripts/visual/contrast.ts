/**
 * npm run report:contrast [-- --no-build --states a,b --themes a,b --viewports desktop]
 *
 * What the browser actually draws, per theme: axe's colour-contrast rule
 * (WCAG 1.4.3, AA) and color-contrast-enhanced (1.4.6, AAA, for information)
 * on every state × theme, keeping axe's data for every text element it
 * measured (passes too), not only failures: foreground, background, ratio,
 * size and weight. Elements axe couldn't measure (text over an image or a
 * gradient, overlapping layers) are kept as "needs review". The role pairs are
 * scripts/design/contrast-roles.ts; docs/contrast-testing.md is the process.
 *
 * Writes .visual/contrast/pages.json: per theme, every distinct
 * (foreground, background, size) pair with its ratio, verdict, and where.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { OUT_DIR } from './config'
import { build, startServer } from './server'
import { parseFilter, walk } from './walk'

const args = process.argv.slice(2)
const root = process.cwd()
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

interface Measured {
  fg: string
  bg: string
  ratio: number
  need: number
  size: string
  weight: string
  text: string
  target: string
  result: 'pass' | 'fail' | 'review'
  /** Why axe couldn't measure it, for "review". */
  why?: string
  aaa?: boolean
}
interface Pair {
  fg: string
  bg: string
  ratio: number
  need: number
  size: string
  weight: string
  result: Measured['result']
  aaa: boolean | null
  count: number
  examples: { state: string; viewport: string; text: string; target: string }[]
}

if (!args.includes('--no-build')) build(root)
const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
const byTheme = new Map<string, Map<string, Pair>>()
const reviews = new Map<string, Map<string, number>>()
let pages = 0
try {
  await walk(
    async (page, { state: { id: state }, theme, viewport }) => {
      await page.clock.resume()
      // Finish fades first (themes cross-fade), as check:a11y does.
      await page.evaluate(() => {
        const finish = () => document.getAnimations().forEach((a) => a.effect?.getComputedTiming().endTime !== Infinity && a.finish())
        finish()
        void getComputedStyle(document.body).color // a style pass, so the finished state takes effect
        finish()
      })
      await page.evaluate(axeSource)
      const found: Measured[] = await page.evaluate(async () => {
        type Node = { target: string[]; html: string; any: { data?: Record<string, unknown>; message: string }[] }
        type Result = { id: string; nodes: Node[] }
        const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: Result[]; passes: Result[]; incomplete: Result[] }> } }).axe
        const r = await axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast', 'color-contrast-enhanced'] }, resultTypes: ['violations', 'passes', 'incomplete'] })
        const out: Measured[] = []
        const textOf = (target: string) => (document.querySelector(target)?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
        const aaa = new Map<string, boolean>()
        for (const [list, ok] of [[r.passes, true], [r.violations, false]] as const)
          for (const res of list) if (res.id === 'color-contrast-enhanced') for (const n of res.nodes) aaa.set(n.target.join(' '), ok)
        for (const [list, result] of [[r.passes, 'pass'], [r.violations, 'fail'], [r.incomplete, 'review']] as const) {
          for (const res of list) {
            if (res.id !== 'color-contrast') continue
            for (const n of res.nodes) {
              const d = (n.any[0]?.data ?? {}) as Record<string, string | number>
              const target = n.target.join(' ')
              out.push({
                fg: String(d.fgColor ?? ''),
                bg: String(d.bgColor ?? ''),
                ratio: Number(d.contrastRatio ?? 0),
                need: Number(String(d.expectedContrastRatio ?? '4.5:1').split(':')[0]),
                size: String(d.fontSize ?? ''),
                weight: String(d.fontWeight ?? ''),
                text: textOf(target),
                target,
                result,
                why: result === 'review' ? String(d.messageKey ?? '') || n.any[0]?.message : undefined,
                aaa: aaa.get(target),
              })
            }
          }
        }
        return out
      })
      pages++
      const pairs = byTheme.get(theme) ?? new Map<string, Pair>()
      byTheme.set(theme, pairs)
      for (const m of found) {
        // Passes without colour data (nothing drawn) say nothing.
        if (m.result !== 'review' && !m.ratio) continue
        if (m.result === 'review') {
          const rv = reviews.get(theme) ?? new Map<string, number>()
          reviews.set(theme, rv)
          rv.set(`${m.why}`, (rv.get(`${m.why}`) ?? 0) + 1)
          continue
        }
        const key = `${m.fg}|${m.bg}|${m.size}|${m.weight}`
        const p = pairs.get(key) ?? { fg: m.fg, bg: m.bg, ratio: m.ratio, need: m.need, size: m.size, weight: m.weight, result: m.result, aaa: m.aaa ?? null, count: 0, examples: [] }
        p.count++
        if (p.examples.length < 4 && !p.examples.some((e) => e.state === state)) p.examples.push({ state, viewport, text: m.text, target: m.target })
        pairs.set(key, p)
      }
    },
    { ...parseFilter(args) },
  )
} finally {
  await server.stop()
}

const dir = resolve(root, OUT_DIR, 'contrast')
mkdirSync(dir, { recursive: true })
const report = [...byTheme].map(([theme, pairs]) => ({
  theme,
  pairs: [...pairs.values()].sort((a, b) => a.ratio - b.ratio),
  reviews: [...(reviews.get(theme) ?? new Map())].map(([why, count]) => ({ why, count })),
}))
writeFileSync(join(dir, 'pages.json'), JSON.stringify(report, null, 1))
console.log(`${pages} pages measured.`)
for (const t of report) {
  const fails = t.pairs.filter((p) => p.result === 'fail')
  console.log(`${t.theme}: ${t.pairs.length} distinct text colour pairs, ${fails.length} below AA, ${t.reviews.reduce((n, r) => n + r.count, 0)} elements axe couldn't measure`)
}
