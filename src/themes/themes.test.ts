/**
 * Theme conformance: the rules every theme must meet, checked for each entry
 * in THEMES. CLAUDE.md lists the same rules in prose.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SYSTEM_THEME, THEME_SECTIONS, THEMES } from '.'
import { contrast, difference } from '../test/colour'
import { analyse, editorDims } from './pairs'

// Read from disk: Vitest stubs out CSS imports, even with ?raw.
const css = readFileSync(new URL('./themes.css', import.meta.url), 'utf8')
const primitivesCss = readFileSync(new URL('../design/primitives.css', import.meta.url), 'utf8')
const dims = editorDims(readFileSync(new URL('../styles/editor.css', import.meta.url), 'utf8'))

/** Every colour role a theme sets (shadcn's names, plus success, overlay, shadow-color, the code colours and the tab marker). */
export const ROLES = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
  'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'destructive-muted', 'success',
  'border', 'input', 'ring', 'overlay', 'shadow-color',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'code-keyword', 'code-string', 'code-number', 'code-function', 'code-type', 'code-comment', 'code-punctuation',
  'tab-indicator',
]
const CHARTS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']
/** T3: minimum contrast against the theme's backgrounds (WCAG ratios). */
export const MIN_CONTRAST = { text: 4.5, code: 4, comment: 2.5, ui: 3 }
/**
 * T4: for a colour vision theme, the least CIEDE2000 difference between the
 * colours that must be told apart, as its audience sees them and with normal
 * vision (10 or more reads as clearly different), and between mistakes and
 * success. Chart colours keep the same distance from each other in every theme.
 */
export const MIN_DIFFERENCE = { distinct: 12, mistakeVsSuccess: 30 }

/**
 * Contrast and distance failures known before the contrast round, each as
 * "<theme>: <check>". The checks still run: a new failure fails the test, and
 * so does a listed one that passes (take it off the list).
 */
const KNOWN_FAILURES = new Set([
  'light: primary-foreground on primary',
  'one-dark-pro: destructive on destructive-muted',
  'phosphor: chart colours apart',
])

/**
 * T6 failures in themes flagged `wcag: 'AA'`, known when the flag went on
 * (contrast round, November 2026), each as "<theme>: <pair>" from pairs.ts,
 * with "(as seen)" for a colour vision theme's simulated view, and T4's
 * success check. Each later step takes its share off; the list may only shrink.
 * AC 2 added six pairs it newly measures, all drawn in palette colours AC 4
 * fixes (the comment colour, Syntype Light's orange, string and number on the
 * highlighted suggestion row, Syntype Dark's secondary text on your
 * leaderboard row).
 */
const KNOWN_AA_FAILURES = new Set<string>([
  'light: Primary text on the page',
  'light: Primary text on cards',
  'light: Primary text in dialogs',
  'light: Selected chip or nav label',
  'light: Button label on primary',
  'light: Success text',
  'light: Error text on the page',
  'light: Destructive button label',
  'light: Comment',
  'light: Mistake on its tint',
  'light: Next character in a comment',
  'light: Current line number',
  'light: Suggestion icon on the highlighted row (string)',
  'light: Suggestion icon on the highlighted row (number)',
  'light: Text field border',
  'light: Text field border in a dialog',
  'dark: Comment',
  'dark: Next character in a comment',
  'dark: Secondary text on your leaderboard row',
  'dark: Text field border',
  'dark: Text field border in a dialog',
  'protanopia: Text field border',
  'protanopia: Text field border (as seen)',
  'protanopia: Text field border in a dialog',
  'protanopia: Text field border in a dialog (as seen)',
  'protanopia: success apart from code colours as seen',
  'deuteranopia: Text field border',
  'deuteranopia: Text field border (as seen)',
  'deuteranopia: Text field border in a dialog',
  'deuteranopia: Text field border in a dialog (as seen)',
  'deuteranopia: success apart from code colours as seen',
  'deuteranopia: success apart from code colours with normal vision',
  'tritanopia: Destructive button label (as seen)',
  'tritanopia: Text field border',
  'tritanopia: Text field border (as seen)',
  'tritanopia: Text field border in a dialog',
  'tritanopia: Text field border in a dialog (as seen)',
  'tritanopia: success apart from code colours as seen',
])

/** Names retired by the move to roles: no stylesheet, component or script may use them. */
const RETIRED = [
  'bg', 'fg', 'surface', 'surface-2', 'line', 'accent-soft', 'err', 'err-soft', 'ok',
  'tok-kw', 'tok-str', 'tok-num', 'tok-fn', 'tok-ty', 'tok-com', 'tok-pun', 'glow', 'tab-dot',
  'f-ui', 'f-code', 'f-display', 'theme-fade',
]

/** Which palette each theme draws from (T5). */
const FAMILY: Record<string, string> = {
  light: 'syntype', dark: 'syntype', phosphor: 'syntype',
  'one-dark-pro': 'onedark', 'github-light': 'primer-light',
  protanopia: 'primer-dark', deuteranopia: 'primer-dark', tritanopia: 'primer-dark',
  'hc-black': 'vscode',
}

/** Every colour primitive's value. */
const primitives = new Map([...primitivesCss.matchAll(/^\s*--([\w-]+):\s*(#[0-9a-f]{6});/gm)].map((m) => [m[1], m[2]]))

/** Each CSS block: its selector list and its declarations. Comments are dropped. */
function blocks(source: string) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...text.matchAll(/([^{};]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    decls: Object.fromEntries(
      body
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
    ),
  }))
}

const themeBlocks = blocks(css)
const declsOf = (id: string) => {
  const found = themeBlocks.filter((b) => b.selector.split(',').some((s) => s.trim() === `[data-syntype-theme="${id}"]`))
  return found.length === 1 ? found[0].decls : null
}
/** A role's colour in a theme, through its primitive. */
const colourOf = (decls: Record<string, string> | null) => (role: string) => {
  const name = decls?.[`--${role}`]?.match(/^var\(--([\w-]+)\)$/)?.[1]
  return (name && primitives.get(name)) || ''
}

/** Checks that a theme meets `ok`, unless the failure is known; and that a known failure still fails. */
function expectUnlessKnown(theme: string, check: string, ok: boolean, detail: string) {
  const known = KNOWN_FAILURES.has(`${theme}: ${check}`) || KNOWN_AA_FAILURES.has(`${theme}: ${check}`)
  expect(ok, known ? `${theme}: ${check} now passes; take it off KNOWN_FAILURES` : `${theme}: ${detail}`).toBe(!known)
}

describe('T1 · every theme has a unique id, a section and its own colours', () => {
  it('ids do not repeat, and every block in themes.css belongs to a listed theme', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    const inCss = [...css.matchAll(/\[data-syntype-theme="([^"]+)"\]/g)].map((m) => m[1])
    for (const id of inCss) expect(ids, `themes.css has a block for unlisted theme ${id}`).toContain(id)
  })

  it('System follows the computer: its dark colours match Syntype Dark', () => {
    const media = themeBlocks.find((b) => b.selector.includes(':root:not([data-theme="light"])'))
    const dark = declsOf('dark')!
    expect(media).toBeDefined()
    for (const [k, v] of Object.entries(media!.decls)) expect(dark[k], k).toBe(v)
  })

  it('every role is registered, so theme changes cross-fade', () => {
    for (const role of ROLES) expect(css, `@property --${role}`).toContain(`@property --${role} {`)
  })
})

describe('retired token names', () => {
  /** Every source file that styles the app: stylesheets, components, scripts, pages. */
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return statSync(p).isDirectory() ? files(p) : /\.(css|tsx?|mjs|html)$/.test(f) ? [p] : []
    })
  it.each(RETIRED)('nothing uses --%s', (name) => {
    const root = new URL('../../', import.meta.url).pathname
    const used = [...files(join(root, 'src')), ...files(join(root, 'scripts')), join(root, 'index.html')].filter((f) =>
      new RegExp(`var\\(--${name}[,)]|^\\s*--${name}:`, 'm').test(readFileSync(f, 'utf8')),
    )
    expect(used).toEqual([])
  })
})

describe.each(THEMES.filter((t) => t.id !== SYSTEM_THEME).map((t) => [t.name, t] as const))('%s', (_, theme) => {
  const decls = declsOf(theme.id)
  const color = colourOf(decls)

  it('T1 · is in a picker section and has one block in themes.css setting every role', () => {
    expect(THEME_SECTIONS).toContain(theme.section)
    expect(decls, `add a [data-syntype-theme="${theme.id}"] block to themes.css`).not.toBeNull()
    for (const role of ROLES) expect(color(role), `--${role} is a primitive`).toMatch(/^#[0-9a-f]{6}$/)
    expect(decls!['--code-glow'], '--code-glow').toBeDefined()
    expect(['light', 'dark']).toContain(decls!['color-scheme'])
  })

  it('T2 · its swatches name real themes', () => {
    for (const id of theme.swatches ?? []) expect(declsOf(id), id).not.toBeNull()
  })

  it("T5 · uses only its own palette's primitives", () => {
    const family = FAMILY[theme.id]
    expect(family, `add ${theme.id} to FAMILY`).toBeDefined()
    for (const [prop, value] of Object.entries(decls!)) {
      for (const [, name] of value.matchAll(/var\(--([\w-]+)\)/g)) {
        expect(name.startsWith(`${family}-`), `${prop}: --${name} is not a ${family} primitive`).toBe(true)
        expect(primitives.has(name), `${prop}: --${name} exists`).toBe(true)
      }
      if (prop !== 'color-scheme') expect(value, `${prop} names no colour of its own`).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    }
    // Exceptions are High Contrast's own, until its outline replaces them (design system steps 10–12).
    const exceptions = Object.values(decls!).filter((v) => v.includes('-exception-'))
    expect(exceptions.length === 0 || theme.id === 'hc-black').toBe(true)
  })

  it('T3 · text and code are readable against its backgrounds', () => {
    const grounds = ['background', 'card', 'muted']
    const check = (name: string, min: number, against = grounds) => {
      for (const g of against) {
        const ratio = contrast(color(name), color(g))
        expect(ratio, `--${name} on --${g}: ${ratio.toFixed(2)}, needs ${min}`).toBeGreaterThanOrEqual(min)
      }
    }
    check('foreground', MIN_CONTRAST.text)
    check('muted-foreground', MIN_CONTRAST.text, ['background', 'card'])
    for (const c of ['keyword', 'string', 'number', 'function', 'type', 'punctuation']) check(`code-${c}`, MIN_CONTRAST.code, ['card'])
    check('code-comment', MIN_CONTRAST.comment, ['card'])
    for (const ui of ['primary', 'destructive', 'success']) check(ui, MIN_CONTRAST.ui, ['background', 'card'])
  })

  it.each([
    ['primary-foreground on primary', 'primary-foreground', 'primary', MIN_CONTRAST.text],
    ['accent-foreground on accent', 'accent-foreground', 'accent', MIN_CONTRAST.text],
    ['destructive on destructive-muted', 'destructive', 'destructive-muted', MIN_CONTRAST.code],
  ] as const)('T3 · %s', (check, fg, bg, min) => {
    const ratio = contrast(color(fg), color(bg))
    expectUnlessKnown(theme.id, check, ratio >= min, `--${fg} on --${bg}: ${ratio.toFixed(2)}, needs ${min}`)
  })

  it('T3 · chart colours stand out from the backgrounds and from each other', () => {
    for (const c of CHARTS)
      for (const g of ['background', 'card']) {
        const ratio = contrast(color(c), color(g))
        expect(ratio, `--${c} on --${g}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(MIN_CONTRAST.ui)
      }
    const gaps = CHARTS.flatMap((a, i) => CHARTS.slice(i + 1).map((b) => ({ pair: `${a}/${b}`, diff: difference(color(a), color(b)) })))
    const worst = gaps.reduce((a, b) => (b.diff < a.diff ? b : a))
    expectUnlessKnown(theme.id, 'chart colours apart', worst.diff >= MIN_DIFFERENCE.distinct, `${worst.pair}: ${worst.diff.toFixed(1)}`)
  })
})

describe.each(THEMES.filter((t) => t.vision).map((t) => [t.name, t] as const))('%s', (_, theme) => {
  const color = colourOf(declsOf(theme.id))
  const vision = theme.vision!
  const apart = (names: string[], seenWith: typeof vision | undefined) => {
    for (let i = 0; i < names.length; i++)
      for (const other of names.slice(i + 1)) {
        const diff = difference(color(names[i]), color(other), seenWith)
        expect(diff, `--${names[i]} vs --${other}: ${diff.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_DIFFERENCE.distinct)
      }
  }

  it.each([
    ['as its audience sees it', vision],
    ['with normal vision', undefined],
  ] as const)('T4 · text, comments, mistakes and code colours stay apart %s', (_, seenWith) => {
    apart(['foreground', 'code-comment', 'destructive', 'code-keyword', 'code-string', 'code-number', 'code-function', 'code-type'], seenWith)
  })

  it('T4 · chart colours stay apart as its audience sees them', () => apart(CHARTS, vision))

  it('T4 · mistakes and success look different, and signals stay readable, as its audience sees them', () => {
    expect(difference(color('destructive'), color('success'), vision)).toBeGreaterThanOrEqual(MIN_DIFFERENCE.mistakeVsSuccess)
    expect(contrast(color('foreground'), color('card'), vision)).toBeGreaterThanOrEqual(MIN_CONTRAST.text)
    for (const ui of ['primary', 'destructive', 'success'])
      expect(contrast(color(ui), color('card'), vision), ui).toBeGreaterThanOrEqual(MIN_CONTRAST.ui)
  })
})

describe('T6 · themes flagged as meeting WCAG AA', () => {
  it('System is flagged only if Syntype Light and Dark both are', () => {
    const flagged = (id: string) => THEMES.find((t) => t.id === id)?.wcag === 'AA'
    if (flagged(SYSTEM_THEME)) for (const id of ['light', 'dark']) expect(flagged(id), id).toBe(true)
  })

  it('every known failure names a flagged theme and a pair it draws', () => {
    const names = new Set<string>()
    for (const t of THEMES.filter((t) => t.wcag && t.id !== SYSTEM_THEME)) {
      const color = colourOf(declsOf(t.id))
      for (const r of analyse(Object.fromEntries(ROLES.map((x) => [x, color(x)])), 'light', dims).concat(analyse(Object.fromEntries(ROLES.map((x) => [x, color(x)])), 'dark', dims))) {
        names.add(`${t.id}: ${r.name}`)
        names.add(`${t.id}: ${r.name} (as seen)`)
      }
      for (const v of ['as seen', 'with normal vision']) names.add(`${t.id}: success apart from code colours ${v}`)
    }
    expect([...KNOWN_AA_FAILURES].filter((k) => !names.has(k))).toEqual([])
  })
})

describe.each(THEMES.filter((t) => t.wcag && t.id !== SYSTEM_THEME).map((t) => [t.name, t] as const))('%s', (_, theme) => {
  const decls = declsOf(theme.id)
  const color = colourOf(decls)
  const roles = Object.fromEntries(ROLES.map((r) => [r, color(r)]))

  it('T6 · every colour pair it draws meets WCAG AA (4.5:1 text, 3:1 large and non-text)', () => {
    const problems: string[] = []
    for (const r of analyse(roles, decls!['color-scheme'] as 'light' | 'dark', dims, theme.vision)) {
      if (r.status === 'exempt') continue
      const views: [string, number][] = [[r.name, r.ratio]]
      if (theme.vision) views.push([`${r.name} (as seen)`, r.seenRatio!])
      for (const [name, ratio] of views) {
        const key = `${theme.id}: ${name}`
        const known = KNOWN_AA_FAILURES.has(key)
        if (ratio >= r.need && known) problems.push(`${key} now passes; take it off KNOWN_AA_FAILURES`)
        if (ratio < r.need && !known) problems.push(`${key}: ${ratio}:1, needs ${r.need}:1 (${r.fgLabel} ${r.fg} on ${r.bgLabel} ${r.bg}; ${r.where})`)
      }
    }
    expect(problems).toEqual([])
  })
})

describe.each(THEMES.filter((t) => t.vision).map((t) => [t.name, t] as const))('%s', (_, theme) => {
  const color = colourOf(declsOf(theme.id))
  it.each([
    ['as seen', theme.vision],
    ['with normal vision', undefined],
  ] as const)('T4 · success stays apart from the code colours %s', (view, seenWith) => {
    const close = ['code-keyword', 'code-string', 'code-number', 'code-function', 'code-type']
      .map((c) => ({ c, diff: difference(color('success'), color(c), seenWith) }))
      .filter((x) => x.diff < MIN_DIFFERENCE.distinct)
    expectUnlessKnown(theme.id, `success apart from code colours ${view}`, close.length === 0, close.map((x) => `--success vs --${x.c}: ${x.diff.toFixed(1)}`).join(', '))
  })
})
