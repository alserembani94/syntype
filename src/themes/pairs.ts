/**
 * Every colour pair the app draws, for checking contrast against WCAG 2.2
 * (docs/contrast-testing.md): text 4.5:1 (1.4.3), large text 3:1, non-text
 * 3:1 (1.4.11). Used by the theme test (T6, for themes flagged `wcag: 'AA'`)
 * and by the contrast report (scripts/design/contrast-roles.ts). Add a pair
 * here when a component draws a new combination, with where it's drawn.
 *
 * Translucent colours are composited over their background as the browser
 * does (sRGB alpha blending; Tailwind's `bg-x/50` and the editor's
 * color-mix(…, transparent) both come down to it). The editor's dimming is
 * read from editor.css (`editorDims`), so the pairs follow it when it changes.
 */
import { contrast } from '../test/colour'
import type { Deficiency } from '.'

export type Kind = 'text' | 'large' | 'ui'
/** A colour spec: a role, or a role at an alpha over another spec. */
export type Spec = string | { role: string; alpha: number; over: Spec }
export interface Pair {
  group: string
  name: string
  fg: Spec
  bg: Spec
  kind: Kind
  where: string
  /** Not something anyone must see to use the app (WCAG exempts it); reported, not failed. */
  exempt?: string
  /** Drawn only in light or only in dark themes (Tailwind's dark: variant). */
  scheme?: 'light' | 'dark'
}

/** How strongly the editor draws code in each state (0–1), from editor.css. */
export interface EditorDims {
  /** Code still to type (`.c`). */
  untyped: number
  /** The character at the caret (`.c.cur`). */
  caret: number
  /** Auto-indented and auto-closed text (`.c.auto`). */
  auto: number
  /** A closer auto-close inserted, before the player reaches it (`.c.pending`). */
  pending: number
  /** Line numbers (`.gutter` opacity; 1 when it has none). */
  gutter: number
  /** The line-end marker ↵ (`.c.nl`), faded toward the background. */
  lineEnd: number
}

/** Reads the editor's dimming from editor.css's source. */
export function editorDims(css: string): EditorDims {
  // The pairs below model a character as its token colour mixed with the secondary text colour.
  if (!css.includes('var(--a), var(--muted-foreground)); }')) throw new Error('editor.css: characters no longer mix with --muted-foreground; update pairs.ts')
  const pick = (re: RegExp, what: string) => {
    const m = css.match(re)
    if (!m) throw new Error(`editor.css: can't find ${what}`)
    return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1])
  }
  return {
    untyped: pick(/^\.c \{[^}]*--a:\s*([\d.]+%)/m, '.c --a'),
    caret: pick(/^\.c\.cur \{[^}]*--a:\s*([\d.]+%)/m, '.c.cur --a'),
    auto: pick(/^\.c\.auto[^{]*\{[^}]*--a:\s*([\d.]+%)/m, '.c.auto --a'),
    pending: pick(/^\.c\.pending \{[^}]*--a:\s*([\d.]+%)/m, '.c.pending --a'),
    gutter: /^\.gutter \{[^}]*opacity:/m.test(css) ? pick(/^\.gutter \{[^}]*opacity:\s*([\d.]+)/m, '.gutter opacity') : 1,
    lineEnd: pick(/^\.c\.nl, \.c\.nl\.ok \{[^}]*--a:\s*([\d.]+%)/m, '.c.nl --a'),
  }
}

const m = (role: string, alpha: number, base: Spec) => ({ role, alpha, over: base })

export const pairs = (d: EditorDims): Pair[] => [
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
  { group: 'Text', name: 'Typing-aid tag that is off', fg: 'muted-foreground', bg: 'card', kind: 'text', where: 'My runs and board tables (struck through)' },

  // ——— Brand, state and status as text ———
  { group: 'Accent text', name: 'Primary text on the page', fg: 'primary', bg: 'background', kind: 'text', where: 'links, the brand, selected nav label' },
  { group: 'Accent text', name: 'Primary text on cards', fg: 'primary', bg: 'card', kind: 'text', where: 'best WPM figures, “open ›” links, results labels' },
  { group: 'Accent text', name: 'Primary text in dialogs', fg: 'primary', bg: 'popover', kind: 'text', where: 'links in dialogs, picker checks' },
  { group: 'Accent text', name: 'Selected chip or nav label', fg: 'primary', bg: 'accent', kind: 'text', where: 'length, aids, Type / My runs / Leaderboard' },
  { group: 'Accent text', name: 'Big numbers (large)', fg: 'primary', bg: 'card', kind: 'large', where: 'results WPM and accuracy, stat values' },
  { group: 'Accent text', name: 'Button label on primary', fg: 'primary-foreground', bg: 'primary', kind: 'text', where: 'default buttons (Type this snippet, Resolve)' },
  { group: 'Text', name: 'Suggestion detail on the highlighted row', fg: 'accent-foreground', bg: 'accent', kind: 'text', where: 'the suggestion list while typing' },
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
  // Each character is its token colour mixed with the secondary text colour (editor.css, span.c).
  { group: 'Code', name: 'Untyped plain text', fg: m('foreground', d.untyped, 'muted-foreground'), bg: 'card', kind: 'text', where: 'code still to type' },
  { group: 'Code', name: 'Untyped keyword', fg: m('code-keyword', d.untyped, 'muted-foreground'), bg: 'card', kind: 'text', where: 'code still to type' },
  { group: 'Code', name: 'Untyped comment', fg: m('code-comment', d.untyped, 'muted-foreground'), bg: 'card', kind: 'text', where: 'code still to type' },
  { group: 'Code', name: 'Next character', fg: m('foreground', d.caret, 'muted-foreground'), bg: 'card', kind: 'text', where: 'the character at the caret' },
  { group: 'Code', name: 'Next character in a comment', fg: m('code-comment', d.caret, 'muted-foreground'), bg: 'card', kind: 'text', where: 'the character at the caret' },
  { group: 'Code', name: 'Auto-inserted text', fg: m('foreground', d.auto, 'muted-foreground'), bg: 'card', kind: 'text', where: 'auto-indent and auto-close text' },
  { group: 'Code', name: 'Auto-closed closer waiting', fg: m('foreground', d.pending, 'muted-foreground'), bg: 'accent', kind: 'text', where: 'a closing bracket auto-close inserted, before the player reaches it' },
  { group: 'Code', name: 'Line numbers', fg: m('muted-foreground', d.gutter, 'card'), bg: 'card', kind: 'text', where: 'the gutter' },
  { group: 'Code', name: 'Current line number', fg: 'primary', bg: 'card', kind: 'text', where: 'the gutter, the caret\'s line' },
  ...(['keyword', 'string', 'number', 'function', 'type'] as const).map((c) => ({ group: 'Code', name: `Suggestion icon on the highlighted row (${c})`, fg: `code-${c}`, bg: 'accent', kind: 'text' as Kind, where: 'the suggestion list (kw, ƒ …)' })),

  { group: 'Text', name: 'Inactive tab label', fg: 'muted-foreground', bg: 'muted', kind: 'text', where: 'admin tabs, gallery tabs (text-muted-foreground)' },
  { group: 'Text', name: 'Ad placeholder size', fg: 'muted-foreground', bg: 'muted', kind: 'text', where: 'the ad space on results' },

  // ——— Non-text (1.4.11) ———
  { group: 'Non-text', name: 'Line-end marker', fg: m('muted-foreground', d.lineEnd, 'card'), bg: 'card', kind: 'ui', where: 'the ↵ at each line end in the editor' },
  { group: 'Non-text', name: 'Line break to step over', fg: 'primary', bg: 'card', kind: 'ui', where: 'the ↵ that auto-close moved down' },
  { group: 'Non-text', name: 'Text field border', fg: 'input', bg: 'background', kind: 'ui', where: 'inputs, checkboxes, the search box' },
  { group: 'Non-text', name: 'Text field border in a dialog', fg: 'input', bg: 'popover', kind: 'ui', where: 'the name step, Account & data' },
  { group: 'Non-text', name: 'Focus ring', fg: 'ring', bg: 'background', kind: 'ui', where: 'every focused control' },
  { group: 'Non-text', name: 'Focus ring in a dialog', fg: 'ring', bg: 'popover', kind: 'ui', where: 'focused controls in dialogs' },
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

export const NEED: Record<Kind, number> = { text: 4.5, large: 3, ui: 3 }
export const AAA: Record<Kind, number | null> = { text: 7, large: 4.5, ui: null }

const hex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')
const rgbOf = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
/** `fg` at `alpha` over `bg`, blended in sRGB as the browser composites it. */
export const over = (fg: string, alpha: number, bg: string) => hex(rgbOf(fg).map((c, i) => c * alpha + rgbOf(bg)[i] * (1 - alpha)))
const resolve = (r: Record<string, string>, s: Spec): string => (typeof s === 'string' ? r[s] : over(r[s.role], s.alpha, resolve(r, s.over)))
const label = (s: Spec): string => (typeof s === 'string' ? s : `${s.role}/${Math.round(s.alpha * 100)} on ${label(s.over)}`)

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

/** Every pair a theme draws, with its contrast, given the theme's roles (as hex) and colour scheme. */
export function analyse(roles: Record<string, string>, scheme: 'light' | 'dark', dims: EditorDims, vision?: Deficiency): Row[] {
  return pairs(dims)
    .filter((p) => !p.scheme || p.scheme === scheme)
    .map((p) => {
      const fg = resolve(roles, p.fg)
      const bg = resolve(roles, p.bg)
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
