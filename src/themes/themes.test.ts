/**
 * Theme conformance: the rules every theme must meet, checked for each entry
 * in THEMES. CLAUDE.md lists the same rules in prose.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SYSTEM_THEME, THEME_SECTIONS, THEMES } from '.'

// Read from disk: Vitest stubs out CSS imports, even with ?raw.
const css = readFileSync(new URL('./themes.css', import.meta.url), 'utf8')

/** Every theme sets all of these. */
const VARIABLES = [
  'bg', 'surface', 'surface-2', 'line', 'fg', 'muted', 'accent', 'accent-soft', 'err', 'err-soft', 'ok',
  'tok-kw', 'tok-str', 'tok-num', 'tok-fn', 'tok-ty', 'tok-com', 'tok-pun', 'glow', 'tab-dot',
]
/** T3: minimum contrast against the theme's backgrounds (WCAG ratios). */
export const MIN_CONTRAST = { text: 4.5, code: 4, comment: 2.5, ui: 3 }

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

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
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
