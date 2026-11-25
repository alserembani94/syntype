/**
 * Theme conformance: the rules every theme must meet, checked for each entry
 * in THEMES. CLAUDE.md lists the same rules in prose.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SYSTEM_THEME, THEME_SECTIONS, THEMES } from '.'
import { contrast, difference } from '../test/colour'

// Read from disk: Vitest stubs out CSS imports, even with ?raw.
const css = readFileSync(new URL('./themes.css', import.meta.url), 'utf8')

/** Every theme sets all of these. */
const VARIABLES = [
  'bg', 'surface', 'surface-2', 'line', 'fg', 'muted', 'accent', 'accent-soft', 'err', 'err-soft', 'ok',
  'tok-kw', 'tok-str', 'tok-num', 'tok-fn', 'tok-ty', 'tok-com', 'tok-pun', 'glow', 'tab-dot',
]
/** T3: minimum contrast against the theme's backgrounds (WCAG ratios). */
export const MIN_CONTRAST = { text: 4.5, code: 4, comment: 2.5, ui: 3 }
/**
 * T4: for a colour vision theme, the least CIEDE2000 difference between the
 * colours that must be told apart, as its audience sees them and with normal
 * vision (10 or more reads as clearly different), and between mistakes and
 * success.
 */
export const MIN_DIFFERENCE = { distinct: 12, mistakeVsSuccess: 30 }

/** Each CSS block: its selector list and its declarations. Comments are dropped. */
function blocks(source: string) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
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
})

describe.each(THEMES.filter((t) => t.id !== SYSTEM_THEME).map((t) => [t.name, t] as const))('%s', (_, theme) => {
  const decls = declsOf(theme.id)
  const color = (name: string) => decls?.[`--${name}`] ?? ''

  it('T1 · is in a picker section and has one block in themes.css setting every colour', () => {
    expect(THEME_SECTIONS).toContain(theme.section)
    expect(decls, `add a [data-syntype-theme="${theme.id}"] block to themes.css`).not.toBeNull()
    for (const v of VARIABLES) expect(decls![`--${v}`], `--${v}`).toBeDefined()
    expect(['light', 'dark']).toContain(decls!['color-scheme'])
    for (const v of VARIABLES.filter((v) => v !== 'glow')) expect(color(v), `--${v}`).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('T2 · its swatches name real themes', () => {
    for (const id of theme.swatches ?? []) expect(declsOf(id), id).not.toBeNull()
  })

  it('T3 · text and code are readable against its backgrounds', () => {
    const grounds = ['bg', 'surface', 'surface-2']
    const check = (name: string, min: number, against = grounds) => {
      for (const g of against) {
        const ratio = contrast(color(name), color(g))
        expect(ratio, `--${name} on --${g}: ${ratio.toFixed(2)}, needs ${min}`).toBeGreaterThanOrEqual(min)
      }
    }
    check('fg', MIN_CONTRAST.text)
    check('muted', MIN_CONTRAST.text, ['bg', 'surface'])
    for (const t of ['kw', 'str', 'num', 'fn', 'ty', 'pun']) check(`tok-${t}`, MIN_CONTRAST.code, ['surface'])
    check('tok-com', MIN_CONTRAST.comment, ['surface'])
    for (const ui of ['accent', 'err', 'ok']) check(ui, MIN_CONTRAST.ui, ['bg', 'surface'])
  })
})

describe.each(THEMES.filter((t) => t.vision).map((t) => [t.name, t] as const))('%s', (_, theme) => {
  const decls = declsOf(theme.id)!
  const color = (name: string) => decls[`--${name}`]
  const vision = theme.vision!
  /** Plain text, comments, mistakes and the code colours: each must look different from the others. */
  const distinct = ['fg', 'tok-com', 'err', 'tok-kw', 'tok-str', 'tok-num', 'tok-fn', 'tok-ty']

  it.each([
    ['as its audience sees it', vision],
    ['with normal vision', undefined],
  ] as const)('T4 · text, comments, mistakes and code colours stay apart %s', (_, seenWith) => {
    for (let i = 0; i < distinct.length; i++)
      for (const other of distinct.slice(i + 1)) {
        const diff = difference(color(distinct[i]), color(other), seenWith)
        expect(diff, `--${distinct[i]} vs --${other}: ${diff.toFixed(1)}`).toBeGreaterThanOrEqual(MIN_DIFFERENCE.distinct)
      }
  })

  it('T4 · mistakes and success look different, and signals stay readable, as its audience sees them', () => {
    expect(difference(color('err'), color('ok'), vision)).toBeGreaterThanOrEqual(MIN_DIFFERENCE.mistakeVsSuccess)
    expect(contrast(color('fg'), color('surface'), vision)).toBeGreaterThanOrEqual(MIN_CONTRAST.text)
    for (const ui of ['accent', 'err', 'ok'])
      expect(contrast(color(ui), color('surface'), vision), ui).toBeGreaterThanOrEqual(MIN_CONTRAST.ui)
  })
})
