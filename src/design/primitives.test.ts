/**
 * The primitives layer (src/design/primitives.css): borrowed colours equal
 * their sources, Syntype's own colours are named by their lightness, and every
 * scale is complete. That themes use only their own palette's primitives (T5)
 * is checked in src/themes/themes.test.ts.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Read from disk: Vitest stubs out CSS imports, even with ?raw.
const css = readFileSync(new URL('./primitives.css', import.meta.url), 'utf8')

type Snapshot = { sources: object[]; colors: Record<string, string> }
const FAMILIES = ['syntype', 'onedark', 'primer-light', 'primer-dark', 'vscode'] as const
type Family = (typeof FAMILIES)[number]
const snapshots = Object.fromEntries(
  FAMILIES.filter((f) => f !== 'syntype').map((f) => [f, JSON.parse(readFileSync(new URL(`./sources/${f}.json`, import.meta.url), 'utf8')) as Snapshot]),
) as Record<Exclude<Family, 'syntype'>, Snapshot>

interface Primitive {
  name: string
  family: Family
  value: string
  comment: string
}
/** Every colour primitive: `--name: #hex; /* comment *\/`. */
const primitives: Primitive[] = [...css.matchAll(/^\s*--([\w-]+):\s*(#[0-9a-f]{6});\s*\/\*\s*(.*?)\s*\*\/$/gm)].map((m) => ({
  name: m[1],
  family: FAMILIES.find((f) => m[1].startsWith(`${f}-`)) as Family,
  value: m[2],
  comment: m[3],
}))

/** Blends a translucent #rrggbbaa over an opaque #rrggbb, as a browser paints it (as scripts/design/sources.mjs). */
function over(rgba: string, base: string) {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
  const a = c(rgba, 7) / 255
  return '#' + [1, 3, 5].map((i) => Math.round(c(rgba, i) * a + c(base, i) * (1 - a)).toString(16).padStart(2, '0')).join('')
}

/** OKLCH lightness, chroma and hue (degrees) of an sRGB #rrggbb. */
function oklch(hex: string) {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [lin(1), lin(3), lin(5)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, B), H: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

/** Tailwind's lightness ladder (OKLCH L of each step of its neutral scales), with white and black at the ends. */
const LADDER: [number, number][] = [
  [0, 1], [50, 0.985], [100, 0.97], [200, 0.922], [300, 0.87], [400, 0.708], [500, 0.556],
  [600, 0.439], [700, 0.371], [800, 0.269], [900, 0.205], [950, 0.145], [1000, 0],
]
/** Where a lightness falls on the ladder, interpolated (e.g. 131.8). */
function ladderStep(L: number) {
  for (let i = 0; i < LADDER.length - 1; i++) {
    const [s1, l1] = LADDER[i]
    const [s2, l2] = LADDER[i + 1]
    if (L <= l1 && L >= l2) return s1 + ((l1 - L) / (l1 - l2)) * (s2 - s1)
  }
  return L > 1 ? 0 : 1000
}
/** Tailwind's colour families by OKLCH hue. */
const HUES: Record<string, number> = {
  rose: 16, red: 25, orange: 47, amber: 70, yellow: 86, lime: 131, green: 150, emerald: 163, teal: 183,
  cyan: 215, sky: 237, blue: 260, indigo: 277, violet: 293, purple: 304, fuchsia: 322, pink: 354,
}
/** The family a colour is named after: blue-tinted greys are slate, colourless ones gray, the rest by nearest hue. */
function hueFamily({ C, H }: { C: number; H: number }) {
  if (C < 0.002) return 'gray'
  if (C < 0.04 && H >= 230 && H <= 290) return 'slate'
  if (C < 0.01) return 'gray'
  const gap = (n: string) => Math.min(Math.abs(H - HUES[n]), 360 - Math.abs(H - HUES[n]))
  return Object.keys(HUES).reduce((a, b) => (gap(b) < gap(a) ? b : a))
}

describe('primitives', () => {
  it('reads every colour primitive, each in a known palette', () => {
    expect(primitives.length).toBeGreaterThan(100)
    for (const p of primitives) expect(p.family, p.name).toBeDefined()
    expect(new Set(primitives.map((p) => p.name)).size).toBe(primitives.length)
  })

  it('takes each borrowed colour from its source, exactly', () => {
    for (const p of primitives.filter((p) => p.family !== 'syntype' && !p.comment.startsWith('exception:'))) {
      const m = p.comment.match(/^([\w-]+): (.+)$/)
      expect(m?.[1], `${p.name} names its palette's source`).toBe(p.family)
      const colors = snapshots[p.family as Exclude<Family, 'syntype'>].colors
      const key = m![2]
      const blend = key.match(/^over\((.+), (.+)\)$/)
      const value = blend ? over(colors[blend[1]], colors[blend[2]]) : colors[key]
      expect(value, `${p.name}: ${key}`).toBe(p.value)
    }
  })

  it('lists exceptions only for Dark High Contrast, until the outline replaces them', () => {
    const exceptions = primitives.filter((p) => p.comment.startsWith('exception:'))
    expect(exceptions.map((p) => p.name)).toEqual(['vscode-hc-exception-accent-soft', 'vscode-hc-exception-err-soft'])
  })

  it("names Syntype's own colours by family and lightness step", () => {
    const own = primitives.filter((p) => p.family === 'syntype')
    const steps = new Map<string, { step: number; L: number; name: string }[]>()
    for (const p of own) {
      const c = oklch(p.value)
      if (p.name === 'syntype-white') {
        expect(p.value).toBe('#ffffff')
        continue
      }
      const m = p.name.match(/^syntype-([a-z]+)-(\d+)$/)
      expect(m, p.name).not.toBeNull()
      const [, family, step] = m!
      expect(family, `${p.name} (${p.value})`).toBe(hueFamily(c))
      expect(Number(step) % 25, p.name).toBe(0)
      // The nearest step of 25, or the next one along when two colours of a family round to the same step.
      expect(Math.abs(Number(step) - ladderStep(c.L)), `${p.name}: lightness step ${ladderStep(c.L).toFixed(1)}`).toBeLessThanOrEqual(37.5)
      steps.set(family, [...(steps.get(family) ?? []), { step: Number(step), L: c.L, name: p.name }])
    }
    // Within a family, a higher step is always darker.
    for (const list of steps.values()) {
      const sorted = [...list].sort((a, b) => a.step - b.step)
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].L, `${sorted[i].name} darker than ${sorted[i - 1].name}`).toBeLessThan(sorted[i - 1].L)
    }
  })

  it('has every step of the type, radius, shadow, motion and spacing scales', () => {
    const declared = new Set([...css.matchAll(/^\s*--([\w-]+):/gm)].map((m) => m[1]))
    const scales = [
      'font-sans', 'font-mono', 'font-display',
      ...['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', 'display'].map((s) => `text-${s}`),
      'radius', ...['sm', 'md', 'lg', 'xl', '2xl', 'full'].map((s) => `radius-${s}`),
      ...['sm', 'md', 'lg', 'xl'].map((s) => `shadow-${s}`),
      'duration-fast', 'duration-normal', 'duration-slow', 'duration-theme', 'ease-out', 'spacing',
    ]
    for (const s of scales) expect(declared.has(s), `--${s}`).toBe(true)
    // Body text is 16px, the radius Nova's 10px.
    expect(css).toMatch(/--text-base: 1rem;/)
    expect(css).toMatch(/--radius: 0\.625rem;/)
  })
})
