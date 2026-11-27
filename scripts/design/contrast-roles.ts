/**
 * node scripts/visual/run.mjs scripts/design/contrast-roles.ts [--out <file.json>]
 *
 * The contrast of every colour pair the app draws, per theme, against WCAG 2.2
 * (docs/contrast-testing.md). Reads each theme's roles from themes.css through
 * its primitives, composites translucent uses over their background the way
 * the browser does (sRGB alpha blending; Tailwind's `bg-x/50` and the
 * editor's color-mix(…, transparent) both come down to it), and checks:
 *
 * - text (1.4.3): 4.5:1, or 3:1 where the text is large (24px, or 18.66px bold)
 * - non-text (1.4.11): 3:1 for what identifies a control, its state, or a
 *   graphic's meaning (input borders, focus rings, selected states, the caret,
 *   chart lines)
 * - AAA (1.4.6) shown for information: 7:1 text, 4.5:1 large
 *
 * Each pair names where it's drawn, so a failure points at a screen.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { THEMES, SYSTEM_THEME } from '../../src/themes'
import { analyse, editorDims } from '../../src/themes/pairs'

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const primitives = new Map([...read('src/design/primitives.css').matchAll(/^\s*--([\w-]+):\s*(#[0-9a-f]{6});/gm)].map((m) => [m[1], m[2]]))
const themeCss = read('src/themes/themes.css').replace(/\/\*[\s\S]*?\*\//g, '')

/** A theme's colour scheme, from its block. */
function scheme(id: string): 'light' | 'dark' {
  const block = [...themeCss.matchAll(/([^{};]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.split(',').some((s) => s.trim() === `[data-syntype-theme="${id}"]`))
  return /color-scheme:\s*dark/.test(block?.[2] ?? '') ? 'dark' : 'light'
}

/** A theme's roles, as hex colours. */
function roles(id: string): Record<string, string> {
  const block = [...themeCss.matchAll(/([^{};]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.split(',').some((s) => s.trim() === `[data-syntype-theme="${id}"]`))
  if (!block) throw new Error(`no block for ${id}`)
  const out: Record<string, string> = {}
  for (const [, name, value] of block[2].matchAll(/--([\w-]+):\s*var\(--([\w-]+)\)/g)) {
    const hex = primitives.get(value)
    if (hex) out[name] = hex
  }
  return out
}

const dims = editorDims(read('src/styles/editor.css'))
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null
const report = THEMES.filter((t) => t.id !== SYSTEM_THEME).map((t) => ({ id: t.id, name: t.name, vision: t.vision, roles: roles(t.id), wcag: t.wcag, rows: analyse(roles(t.id), scheme(t.id), dims, t.vision) }))
if (out) writeFileSync(out, JSON.stringify(report, null, 1))
for (const t of report) {
  const fails = t.rows.filter((r) => r.status === 'fail')
  console.log(`${t.name}: ${t.rows.length - fails.length - t.rows.filter((r) => r.status === 'exempt').length} pass, ${fails.length} fail`)
  for (const f of fails) console.log(`   ✗ ${f.name}: ${f.ratio}:1 (needs ${f.need}) ${f.fg} on ${f.bg}`)
}
