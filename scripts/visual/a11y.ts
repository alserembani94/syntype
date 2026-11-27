/**
 * npm run check:a11y [-- options]
 *
 * Runs axe-core on every state × theme × viewport (contrast differs by theme,
 * target size by viewport) and writes .visual/a11y-<label>/report.json and
 * summary.md. A failure is a WCAG 2.0–2.2 level A or AA rule; axe's
 * best-practice rules are reported but don't fail. Exits 1 on any failure,
 * unless --record (for the baseline, which records today's failures).
 *   --label <name>  --record  --no-build  --states  --themes  --viewports
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { OUT_DIR } from './config'
import { build, startServer } from './server'
import { parseFilter, walk } from './walk'

const args = process.argv.slice(2)
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const root = process.cwd()
const label = opt('label') ?? 'current'
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

/** The WCAG levels we fail on (our bar: WCAG 2.2 AA). */
const FAIL_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']
/**
 * Findings that aren't failures, each with its reason (as in src/test/axe.ts).
 * The pickers' list is a combobox's popup: the keyboard moves through it from
 * the search box (virtual focus, aria-activedescendant), so the list itself
 * needs no tab stop.
 */
const EXEMPTIONS = [
  { rule: 'scrollable-region-focusable', selector: '[data-slot="command-list"]', why: 'virtual focus from the search box' },
  // The one theme outside WCAG AA (rule T6): One Dark Pro keeps its own comment and error colours (3.73, 4.38 and
  // 3.97:1 where they fail). Documented in docs/contrast-testing.md; every other theme must have no contrast failure.
  { rule: 'color-contrast', selector: '[data-syntype-theme="one-dark-pro"]', why: 'One Dark Pro stays faithful to its source colours' },
]

interface Hit {
  state: string
  theme: string
  viewport: string
  nodes: number
  targets: string[]
}
interface Rule {
  id: string
  help: string
  helpUrl: string
  impact: string | null
  criteria: string[]
  fails: boolean
  hits: Hit[]
}

/** 'wcag143' → '1.4.3'. */
const criterion = (tag: string) => {
  const m = tag.match(/^wcag(\d)(\d)(\d+)$/)
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null
}

if (!args.includes('--no-build')) build(root)
const server = await startServer(root, join(root, 'scripts/visual/fixtures/seed.sql'))
const rules = new Map<string, Rule>()
let checked = 0
try {
  await walk(async (page, { state, theme, viewport }) => {
    // axe uses the page's timers, which the typing states pause; nothing is captured here, so let time run.
    await page.clock.resume()
    // Finish every running transition, as screenshots do: themes cross-fade their colours, and contrast
    // measured mid-fade varies from run to run.
    // Twice, with a style pass between: finishing the theme's fade changes the colours that
    // controls with their own transitions (shadcn's transition-all) then start fading towards.
    // Endless animations (a spinner) can't finish and are left alone.
    await page.evaluate(() => {
      const finish = () => document.getAnimations().forEach((a) => a.effect?.getComputedTiming().endTime !== Infinity && a.finish())
      finish()
      void getComputedStyle(document.body).color // a style pass, so the finished state takes effect
      finish()
    })
    // evaluate() runs outside the page's CSP, so axe needs no script tag.
    await page.evaluate(axeSource)
    const result = await page.evaluate(
      async ({ tags, exemptions }) => {
        const axe = (window as unknown as { axe: { run: (ctx: Document, opts: object) => Promise<{ violations: { id: string; help: string; helpUrl: string; impact: string | null; tags: string[]; nodes: { target: string[] }[] }[] }> } }).axe
        const r = await axe.run(document, { runOnly: { type: 'tag', values: [...tags, 'best-practice'] }, resultTypes: ['violations'] })
        const exempt = (rule: string, target: string) => exemptions.some((e) => e.rule === rule && document.querySelector(target)?.closest(e.selector))
        return r.violations
          .map((v) => ({ id: v.id, help: v.help, helpUrl: v.helpUrl, impact: v.impact, tags: v.tags, targets: v.nodes.map((n) => n.target.join(' ')).filter((t) => !exempt(v.id, t)) }))
          .filter((v) => v.targets.length)
      },
      { tags: FAIL_TAGS, exemptions: EXEMPTIONS },
    )
    checked++
    for (const v of result) {
      const rule = rules.get(v.id) ?? {
        id: v.id,
        help: v.help,
        helpUrl: v.helpUrl,
        impact: v.impact,
        criteria: v.tags.map(criterion).filter((c): c is string => !!c),
        fails: v.tags.some((t) => FAIL_TAGS.includes(t)),
        hits: [],
      }
      rule.hits.push({ state: state.id, theme, viewport, nodes: v.targets.length, targets: v.targets.slice(0, 5) })
      rules.set(v.id, rule)
    }
  }, parseFilter(args))
} finally {
  await server.stop()
}

const all = [...rules.values()].sort((a, b) => Number(b.fails) - Number(a.fails) || b.hits.length - a.hits.length)
const dir = resolve(root, OUT_DIR, `a11y-${label}`)
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'report.json'), JSON.stringify({ checked, rules: all }, null, 1))
const uniq = (xs: string[]) => [...new Set(xs)]
const md = [
  `# Accessibility: ${label}`,
  '',
  `${checked} pages checked (state × theme × viewport). Fails on WCAG 2.2 A/AA; best practice is listed but doesn't fail.`,
  '',
  '| Rule | Fails | WCAG | Impact | Pages | States | Themes |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...all.map((r) => {
    const states = uniq(r.hits.map((h) => h.state))
    const themes = uniq(r.hits.map((h) => h.theme))
    return `| ${r.id}: ${r.help} | ${r.fails ? 'yes' : 'no'} | ${r.criteria.join(', ') || '–'} | ${r.impact ?? '–'} | ${r.hits.length} | ${states.length > 6 ? `${states.length} states` : states.join(', ')} | ${themes.length > 6 ? 'all' : themes.join(', ')} |`
  }),
].join('\n')
writeFileSync(join(dir, 'summary.md'), md + '\n')
const failing = all.filter((r) => r.fails)
console.log(`${checked} pages checked; ${failing.length} failing WCAG rules, ${all.length - failing.length} best-practice findings. Report in ${OUT_DIR}/a11y-${label}/`)
if (failing.length && !args.includes('--record')) process.exitCode = 1
