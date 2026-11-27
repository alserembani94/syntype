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
import { THEMES, SYSTEM_THEME, type Deficiency } from '../../src/themes'
import { contrast } from '../../src/test/colour'

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

const hex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')
const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
/** `fg` at `alpha` over `bg`, blended in sRGB as the browser composites it. */
const over = (fg: string, alpha: number, bg: string) => hex(rgbOf(fg).map((c, i) => c * alpha + rgbOf(bg)[i] * (1 - alpha)))

/** A colour spec: a role, or a role at an alpha over another spec. */
type Spec = string | { role: string; alpha: number; over: Spec }
const resolve = (r: Record<string, string>, s: Spec): string => (typeof s === 'string' ? r[s] : over(r[s.role], s.alpha, resolve(r, s.over)))
const label = (s: Spec): string => (typeof s === 'string' ? s : `${s.role}/${Math.round(s.alpha * 100)} on ${label(s.over)}`)

type Kind = 'text' | 'large' | 'ui'
interface Pair {
  group: string
  name: string
  fg: Spec
  bg: Spec
  kind: Kind
  where: string
  /** Not text the person must read (WCAG exempts it); reported, not failed. */
  exempt?: string
  /** Drawn only in light or only in dark themes (Tailwind's dark: variant). */
  scheme?: 'light' | 'dark'
}
const m = (role: string, alpha: number, base: Spec) => ({ role, alpha, over: base })

/** Every pair the app draws, with where. Keep in step with the UI (docs/contrast-testing.md, step 2). */
const PAIRS: Pair[] = [
  // ——— Text on surfaces ———
  { group: 'Text', name: 'Body text on the page', fg: 'foreground', bg: 'background', kind: 'text', where: 'every screen' },
  { group: 'Text', name: 'Body text on cards and the editor', fg: 'foreground', bg: 'card', kind: 'text', where: 'editor, tables, cards' },
  { group: 'Text', name: 'Body text in dialogs and menus', fg: 'foreground', bg: 'popover', kind: 'text', where: 'dialogs, menus, pickers, toasts' },
  { group: 'Text', name: 'Secondary text on the page', fg: 'muted-foreground', bg: 'background', kind: 'text', where: 'hints, captions, table headings' },
  { group: 'Text', name: 'Secondary text on cards', fg: 'muted-foreground', bg: 'card', kind: 'text', where: 'stat labels, table cells, the tab bar' },
  { group: 'Text', name: 'Secondary text in dialogs', fg: 'muted-foreground', bg: 'popover', kind: 'text', where: 'dialog descriptions, picker details' },
  { group: 'Text', name: 'Secondary text on muted', fg: 'muted-foreground', bg: 'muted', kind: 'text', where: 'the status bar, Kbd keys, the tab bar' },
  { group: 'Text', name: 'Secondary text on a dialog footer', fg: 'muted-foreground', bg: m('muted', 0.5, 'popover'), kind: 'text', where: 'dialog footers (bg-muted/50)' },
  { group: 'Text', name: 'Text in a tooltip', fg: 'background', bg: 'foreground', kind: 'text', where: 'tooltips (inverted)' },
  { group: 'Text', name: 'Typing-aid tag that is off', fg: m('muted-foreground', 0.5, 'card'), bg: 'card', kind: 'text', where: 'My runs and board tables (struck through)' },

  // ——— Brand, state and status as text ———
  { group: 'Accent text', name: 'Primary text on the page', fg: 'primary', bg: 'background', kind: 'text', where: 'links, the brand, selected nav label' },
  { group: 'Accent text', name: 'Primary text on cards', fg: 'primary', bg: 'card', kind: 'text', where: 'best WPM figures, “open ›” links, results labels' },
  { group: 'Accent text', name: 'Primary text in dialogs', fg: 'primary', bg: 'popover', kind: 'text', where: 'links in dialogs, picker checks' },
  { group: 'Accent text', name: 'Selected chip or nav label', fg: 'primary', bg: 'accent', kind: 'text', where: 'length, aids, Type / My runs / Leaderboard' },
  { group: 'Accent text', name: 'Big numbers (large)', fg: 'primary', bg: 'card', kind: 'large', where: 'results WPM and accuracy, stat values' },
  { group: 'Accent text', name: 'Button label on primary', fg: 'primary-foreground', bg: 'primary', kind: 'text', where: 'default buttons (Type this snippet, Resolve)' },
  { group: 'Text', name: 'Suggestion detail on the highlighted row', fg: 'muted-foreground', bg: 'accent', kind: 'text', where: 'the suggestion list while typing' },
  { group: 'Accent text', name: 'Label on a hovered item', fg: 'accent-foreground', bg: 'accent', kind: 'text', where: 'hovered menu items, highlighted rows' },
  { group: 'Accent text', name: 'Label on secondary', fg: 'secondary-foreground', bg: 'secondary', kind: 'text', where: 'secondary buttons and badges' },
  { group: 'Accent text', name: 'Success text', fg: 'success', bg: 'card', kind: 'text', where: '“New personal best”, “best” and “you” marks' },
  { group: 'Accent text', name: 'Error text on the page', fg: 'destructive', bg: 'background', kind: 'text', where: 'errors, “Delete account” heading' },
  { group: 'Accent text', name: 'Error text in dialogs', fg: 'destructive', bg: 'popover', kind: 'text', where: 'dialog errors' },
  { group: 'Accent text', name: 'Destructive button label', fg: 'destructive', bg: m('destructive', 0.1, 'background'), kind: 'text', where: 'Clear…, Remove run, Hide, error badges (bg-destructive/10)', scheme: 'light' },
  { group: 'Accent text', name: 'Destructive button label', fg: 'destructive', bg: m('destructive', 0.2, 'background'), kind: 'text', where: 'Clear…, Remove run, Hide, error badges (dark:bg-destructive/20)', scheme: 'dark' },

  // ——— The editor's code ———
  { group: 'Code', name: 'Keyword', fg: 'code-keyword', bg: 'card', kind: 'text', where: 'typed code' },
  { group: 'Code', name: 'String', fg: 'code-string', bg: 'card', kind: 'text', where: 'typed code' },
  { group: 'Code', name: 'Number', fg: 'code-number', bg: 'card', kind: 'text', where: 'typed code' },
  { group: 'Code', name: 'Function', fg: 'code-function', bg: 'card', kind: 'text', where: 'typed code' },
  { group: 'Code', name: 'Type', fg: 'code-type', bg: 'card', kind: 'text', where: 'typed code' },
  { group: 'Code', name: 'Punctuation', fg: 'code-punctuation', bg: 'card', kind: 'text', where: 'typed code' },
  { group: 'Code', name: 'Comment', fg: 'code-comment', bg: 'card', kind: 'text', where: 'typed code' },
  { group: 'Code', name: 'Mistake on its tint', fg: 'destructive', bg: 'destructive-muted', kind: 'text', where: 'a wrong character (also wavy-underlined)' },
  { group: 'Code', name: 'Untyped plain text (34%)', fg: m('foreground', 0.34, 'card'), bg: 'card', kind: 'text', where: 'code still to type' },
  { group: 'Code', name: 'Untyped keyword (34%)', fg: m('code-keyword', 0.34, 'card'), bg: 'card', kind: 'text', where: 'code still to type' },
  { group: 'Code', name: 'Untyped comment (34%)', fg: m('code-comment', 0.34, 'card'), bg: 'card', kind: 'text', where: 'code still to type' },
  { group: 'Code', name: 'Next character (55%)', fg: m('foreground', 0.55, 'card'), bg: 'card', kind: 'text', where: 'the character at the caret' },
  { group: 'Code', name: 'Auto-inserted text (60%)', fg: m('foreground', 0.6, 'card'), bg: 'card', kind: 'text', where: 'auto-indent and auto-close text' },
  { group: 'Code', name: 'Auto-closed closer waiting (85% on accent)', fg: m('foreground', 0.85, 'accent'), bg: 'accent', kind: 'text', where: 'a closing bracket auto-close inserted, before the player reaches it' },
  { group: 'Code', name: 'Line numbers (55%)', fg: m('muted-foreground', 0.55, 'card'), bg: 'card', kind: 'text', where: 'the gutter', exempt: 'line numbers are decorative (aria-hidden)' },

  // ——— Non-text (1.4.11) ———
  { group: 'Non-text', name: 'Text field border', fg: 'input', bg: 'background', kind: 'ui', where: 'inputs, checkboxes, the search box' },
  { group: 'Non-text', name: 'Text field border in a dialog', fg: 'input', bg: 'popover', kind: 'ui', where: 'the name step, Account & data' },
  { group: 'Non-text', name: 'Focus ring (ring/50)', fg: m('ring', 0.5, 'background'), bg: 'background', kind: 'ui', where: 'every focused control' },
  { group: 'Non-text', name: 'Focus ring in a dialog', fg: m('ring', 0.5, 'popover'), bg: 'popover', kind: 'ui', where: 'focused controls in dialogs' },
  { group: 'Non-text', name: 'Selected chip vs the page', fg: 'accent', bg: 'background', kind: 'ui', where: 'the tint that marks a selected chip', exempt: 'the label colour also changes (see “Selected chip or nav label”)' },
  { group: 'Non-text', name: 'Switch or checkbox on', fg: 'primary', bg: 'popover', kind: 'ui', where: 'Smooth caret, Show me on the leaderboards' },
  { group: 'Non-text', name: 'Caret', fg: 'primary', bg: 'card', kind: 'ui', where: 'the editor' },
  { group: 'Non-text', name: 'Mistake underline', fg: 'destructive', bg: 'card', kind: 'ui', where: 'wavy underline under a wrong character' },
  { group: 'Non-text', name: 'Slider track', fg: 'muted', bg: 'card', kind: 'ui', where: 'the replay position', exempt: 'the filled part and thumb carry the position' },
  { group: 'Non-text', name: 'Slider fill and thumb', fg: 'primary', bg: 'card', kind: 'ui', where: 'the replay position' },
  { group: 'Non-text', name: 'Chart: WPM line', fg: 'primary', bg: 'card', kind: 'ui', where: 'results speed chart' },
  { group: 'Non-text', name: 'Chart: raw line (80%)', fg: m('muted-foreground', 0.8, 'card'), bg: 'card', kind: 'ui', where: 'results speed chart' },
  { group: 'Non-text', name: 'Chart: error marks', fg: 'destructive', bg: 'card', kind: 'ui', where: 'results speed chart' },
  ...[1, 2, 3, 4, 5].map((n) => ({ group: 'Non-text', name: `Chart colour ${n}`, fg: `chart-${n}`, bg: 'card', kind: 'ui' as Kind, where: 'charts (reserved)' })),
]

const NEED: Record<Kind, number> = { text: 4.5, large: 3, ui: 3 }
const AAA: Record<Kind, number | null> = { text: 7, large: 4.5, ui: null }

export interface Row {
  group: string
  name: string
  where: string
  kind: Kind
  fgLabel: string
  bgLabel: string
  fg: string
  bg: string
  ratio: number
  need: number
  aaa: number | null
  status: 'pass' | 'fail' | 'exempt'
  exempt?: string
  /** For colour vision themes: the ratio as their audience sees it. */
  seenRatio?: number
}

export function analyse(id: string, vision?: Deficiency): Row[] {
  const r = roles(id)
  const sc = scheme(id)
  return PAIRS.filter((p) => !p.scheme || p.scheme === sc).map((p) => {
    const fg = resolve(r, p.fg)
    const bg = resolve(r, p.bg)
    const ratio = contrast(fg, bg)
    const need = NEED[p.kind]
    return {
      group: p.group,
      name: p.name,
      where: p.where,
      kind: p.kind,
      fgLabel: label(p.fg),
      bgLabel: label(p.bg),
      fg,
      bg,
      ratio: Math.round(ratio * 100) / 100,
      need,
      aaa: AAA[p.kind],
      status: p.exempt ? 'exempt' : ratio >= need ? 'pass' : 'fail',
      exempt: p.exempt,
      seenRatio: vision ? Math.round(contrast(fg, bg, vision) * 100) / 100 : undefined,
    }
  })
}

const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null
const report = THEMES.filter((t) => t.id !== SYSTEM_THEME).map((t) => ({ id: t.id, name: t.name, vision: t.vision, roles: roles(t.id), rows: analyse(t.id, t.vision) }))
if (out) writeFileSync(out, JSON.stringify(report, null, 1))
for (const t of report) {
  const fails = t.rows.filter((r) => r.status === 'fail')
  console.log(`${t.name}: ${t.rows.length - fails.length - t.rows.filter((r) => r.status === 'exempt').length} pass, ${fails.length} fail`)
  for (const f of fails) console.log(`   ✗ ${f.name}: ${f.ratio}:1 (needs ${f.need}) ${f.fg} on ${f.bg}`)
}
