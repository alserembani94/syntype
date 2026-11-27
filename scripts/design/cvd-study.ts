/**
 * node scripts/visual/run.mjs scripts/design/cvd-study.ts [--out <file.json>]
 *
 * The colour vision themes, studied (docs/contrast-testing.md, "Colour vision"):
 *
 * 1. Today: how far apart each theme's colours are as its audience sees them
 *    (Machado et al. 2009 at full severity, src/test/colour.ts), and their
 *    contrast as seen.
 * 2. References: Okabe–Ito and Paul Tol's "bright" palettes, scored the same
 *    way, to show what a palette designed for colour vision deficiency achieves.
 * 3. A suggestion per deficiency: from Primer's dark display scales (the base
 *    palette, rule T4/T5), the code colours, mistake and success that keep the
 *    smallest difference (CIEDE2000) as large as possible as the audience sees
 *    them, while every one reads at WCAG 4.5:1 on the editor, both as seen and
 *    with normal vision.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { Deficiency } from '../../src/themes'
import { contrast, difference } from '../../src/test/colour'

const VISIONS: Deficiency[] = ['protanopia', 'deuteranopia', 'tritanopia']
const primer = JSON.parse(readFileSync(new URL('../../src/design/sources/primer-dark.json', import.meta.url), 'utf8')).colors as Record<string, string>
const CARD = primer['dark:--bgColor-default'] // the editor's background in the vision themes
const FG = primer['dark:--fgColor-default']
const COMMENT = primer['dark:--fgColor-muted']

/** Primer dark's display scales: every hue, every step. */
const POOL = Object.entries(primer)
  .filter(([k]) => /^dark:--display-[a-z]+-scale-\d+$/.test(k))
  .map(([k, hex]) => ({ name: k.replace('dark:--display-', '').replace('-scale-', '-'), hex: hex.toLowerCase() }))

const REFERENCES = {
  'Okabe–Ito': { orange: '#e69f00', 'sky blue': '#56b4e9', 'bluish green': '#009e73', yellow: '#f0e442', blue: '#0072b2', vermillion: '#d55e00', 'reddish purple': '#cc79a7' },
  'Tol bright': { blue: '#4477aa', red: '#ee6677', green: '#228833', yellow: '#ccbb44', cyan: '#66ccee', purple: '#aa3377', grey: '#bbbbbb' },
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const primitives = new Map([...read('src/design/primitives.css').matchAll(/^\s*--([\w-]+):\s*(#[0-9a-f]{6});/gm)].map((m) => [m[1], m[2]]))
const themeCss = read('src/themes/themes.css').replace(/\/\*[\s\S]*?\*\//g, '')
function roles(id: string): Record<string, string> {
  const block = [...themeCss.matchAll(/([^{};]+)\{([^{}]*)\}/g)].find(([, sel]) => sel.split(',').some((s) => s.trim() === `[data-syntype-theme="${id}"]`))!
  return Object.fromEntries([...block[2].matchAll(/--([\w-]+):\s*var\(--([\w-]+)\)/g)].map(([, n, v]) => [n, primitives.get(v) ?? '']))
}

/** The colours a typist must tell apart while typing, in a vision theme. */
const TELL_APART = ['foreground', 'code-comment', 'code-keyword', 'code-string', 'code-number', 'code-function', 'code-type', 'destructive', 'success']

const r2 = (n: number) => Math.round(n * 100) / 100

/** Pairwise differences as seen, sorted from the closest. */
function closest(colours: Record<string, string>, vision?: Deficiency) {
  const names = Object.keys(colours)
  const out: { a: string; b: string; seen: number }[] = []
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) {
      const [a, b] = [names[i], names[j]]
      if (colours[a] === colours[b]) continue
      out.push({ a, b, seen: r2(difference(colours[a], colours[b], vision)) })
    }
  return out.sort((x, y) => x.seen - y.seen)
}

// ——— 1. Today ———
const today = VISIONS.map((v) => {
  const r = roles(v)
  const set = Object.fromEntries(TELL_APART.map((k) => [k, r[k]]))
  return {
    vision: v,
    colours: set,
    closest: closest(set, v).slice(0, 6),
    contrastSeen: Object.fromEntries(TELL_APART.map((k) => [k, { normal: r2(contrast(r[k], r.card)), seen: r2(contrast(r[k], r.card, v)) }])),
  }
})

// ——— 2. References ———
const references = Object.entries(REFERENCES).map(([name, colours]) => ({
  name,
  colours,
  onEditor: Object.fromEntries(Object.entries(colours).map(([k, hex]) => [k, r2(contrast(hex, CARD))])),
  minSeen: Object.fromEntries([undefined, ...VISIONS].map((v) => [v ?? 'normal', closest(colours, v)[0]])),
}))

// ——— 3. Suggestions ———
/** Readable on the editor as seen and with normal vision (WCAG 1.4.3 for text). */
const readable = (hex: string, v: Deficiency) => contrast(hex, CARD) >= 4.5 && contrast(hex, CARD, v) >= 4.5
const ROLES = ['keyword', 'string', 'number', 'function', 'type', 'mistake', 'success'] as const

/**
 * Mistake and success as Primer's own colour-blind themes have them (dark-colorblind for
 * protanopia and deuteranopia, dark-tritanopia for tritanopia): orange or red for danger and
 * blue for success, the convention this audience already knows from GitHub.
 */
const SIGNALS: Record<Deficiency, { mistake: string; success: string }> = {
  protanopia: { mistake: primer['dark-colorblind:--fgColor-danger'], success: primer['dark-colorblind:--fgColor-success'] },
  deuteranopia: { mistake: primer['dark-colorblind:--fgColor-danger'], success: primer['dark-colorblind:--fgColor-success'] },
  tritanopia: { mistake: primer['dark-tritanopia:--fgColor-danger'], success: primer['dark-tritanopia:--fgColor-success'] },
}

function suggest(v: Deficiency, keepSignals: boolean) {
  const pool = POOL.filter((p) => readable(p.hex, v))
  const fixed: Record<string, string> = { foreground: FG, comment: COMMENT, ...(keepSignals ? SIGNALS[v] : {}) }
  /** The smallest difference in a set, as seen and with normal vision (the theme must work for both). */
  const score = (set: string[]) => {
    const all = [...set, ...Object.values(fixed)]
    let worst = Infinity
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const d = Math.min(difference(all[i], all[j], v), difference(all[i], all[j]))
        if (d < worst) worst = d
      }
    return worst
  }
  // Greedy farthest-point picks, then swaps until no single swap improves the worst pair.
  let set: string[] = []
  const picks = keepSignals ? 5 : ROLES.length
  for (let k = 0; k < picks; k++) {
    let best = pool[0].hex
    let bestScore = -1
    for (const p of pool) {
      if (set.includes(p.hex)) continue
      const s = score([...set, p.hex])
      if (s > bestScore) [best, bestScore] = [p.hex, s]
    }
    set.push(best)
  }
  for (let improved = true; improved; ) {
    improved = false
    for (let i = 0; i < set.length; i++)
      for (const p of pool) {
        if (set.includes(p.hex)) continue
        const next = set.map((h, j) => (j === i ? p.hex : h))
        if (score(next) > score(set) + 0.01) [set, improved] = [next, true]
      }
  }
  // Mistake and success: Primer's own, or the pair that's farthest apart as seen (rule T4 wants 30+).
  if (keepSignals) set = [...set, fixed.mistake, fixed.success]
  let pair: [number, number] = [0, 1]
  for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) if (difference(set[i], set[j], v) > difference(set[pair[0]], set[pair[1]], v)) pair = [i, j]
  if (keepSignals) pair = [5, 6]
  const [m, s] = keepSignals ? pair : difference(set[pair[0]], '#ff0000') < difference(set[pair[1]], '#ff0000') ? pair : [pair[1], pair[0]]
  const code = set.filter((_, i) => i !== m && i !== s)
  const nameOf = (hex: string) => POOL.find((p) => p.hex === hex)?.name ?? hex
  const colours: Record<string, string> = { keyword: code[0], string: code[1], number: code[2], function: code[3], type: code[4], mistake: set[m], success: set[s] }
  delete fixed.mistake
  delete fixed.success
  return {
    vision: v,
    keepSignals,
    poolSize: pool.length,
    colours: Object.fromEntries(Object.entries(colours).map(([k, hex]) => [k, { hex, primer: nameOf(hex), contrast: r2(contrast(hex, CARD)), seen: r2(contrast(hex, CARD, v)) }])),
    minDifference: { seen: r2(Math.min(...closest({ ...colours, ...fixed }, v).map((c) => c.seen))), normal: r2(Math.min(...closest({ ...colours, ...fixed }).map((c) => c.seen))) },
    mistakeVsSuccess: r2(difference(colours.mistake, colours.success, v)),
    closest: closest({ ...colours, ...fixed }, v).slice(0, 4),
  }
}
const suggestions = VISIONS.flatMap((v) => [suggest(v, true), suggest(v, false)])

const report = { card: CARD, foreground: FG, comment: COMMENT, today, references, suggestions }
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null
if (out) writeFileSync(out, JSON.stringify(report, null, 1))
for (const t of today) console.log(`${t.vision} today: closest ${t.closest[0].a}/${t.closest[0].b} ${t.closest[0].seen}`)
for (const r of references) console.log(`${r.name}: closest as seen ${JSON.stringify(Object.fromEntries(Object.entries(r.minSeen).map(([k, c]) => [k, c ? `${c.a}/${c.b} ${c.seen}` : '']))) }`)
for (const s of suggestions) console.log(`${s.vision} ${s.keepSignals ? "(Primer's signals)" : '(free)'}: min ΔE seen ${s.minDifference.seen}, normal ${s.minDifference.normal}, mistake/success ${s.mistakeVsSuccess} ·`, Object.entries(s.colours).map(([k, c]) => `${k} ${c.primer} ${c.hex}`).join(', '))
