/**
 * Constrained IntelliSense: suggestions built only from what we know about the
 * snippet's language and from what the user has typed so far. Pure functions,
 * no React. Behaviour follows VS Code's defaults:
 * - quickSuggestions: on in code, off in strings and comments
 * - a member trigger (".") opens the list straight away with members
 * - word-based words leave out the word being typed and numbers
 * - fuzzy matching where the first letter must hit a word start or camelCase hump
 */
import type { Run } from './engine'
import type { CompletionItem, Language, SuggestionKind } from '../languages/types'
import { tokenize } from './tokenize'
import type { CompletionService, ServiceEntry } from './service'

export type { SuggestionKind }

export interface Suggestion {
  /** What the list shows, e.g. "email?" for an optional member. */
  label: string
  /** What accepting inserts, when it differs from the label. */
  insertText?: string
  kind: SuggestionKind
  /** Characters that accept this item and are then typed (VS Code commit characters). */
  commit?: string[]
  preselect?: boolean
  /** Where it comes from, e.g. "react" or "Math". */
  detail?: string
  score: number
  /** Indexes into label that matched the typed letters, for highlighting. */
  matches: number[]
}

type Item = CompletionItem & { detail?: string }

export interface SuggestConfig {
  keywords: string[]
  /** Which characters make up a word in this language. */
  wordChar: RegExp
  memberTriggers: string[]
  /** Globals from the vocabulary packs active for this snippet. */
  globals: Item[]
  /** Members by receiver, from the active packs. "*" is for receivers we don't know. */
  members: Map<string, Item[]>
  /** Per snippet position: true inside strings and comments, where VS Code shows no quick suggestions. */
  quiet: boolean[]
  memberCommitCharacters: string[]
  /** The language's completion service, if it has one. */
  service: CompletionService | null
  triggerCharacters: string[]
}

/** Builds the suggestion setup for one snippet in one language. */
export function buildSuggestConfig(code: string, lang: Language, withService = true): SuggestConfig {
  const classes = tokenize(code, lang.highlight)
  const packs = (lang.completion?.packs ?? []).filter((p) => !p.detect || p.detect.test(code))
  const globals: Item[] = []
  const members = new Map<string, Item[]>()
  for (const pack of packs) {
    for (const g of pack.globals ?? []) globals.push({ ...g, detail: pack.name })
    for (const [receiver, list] of Object.entries(pack.members ?? {})) {
      const detail = receiver === '*' ? pack.name : receiver
      members.set(receiver, [...(members.get(receiver) ?? []), ...list.map((m) => ({ ...m, detail }))])
    }
  }
  return {
    keywords: lang.highlight.keywords,
    wordChar: lang.completion?.wordChar ?? /[\w$]/,
    memberTriggers: lang.completion?.memberTriggers ?? ['.'],
    globals,
    members,
    quiet: classes.map((c) => c === 'str' || c === 'com'),
    memberCommitCharacters: lang.completion?.memberCommitCharacters ?? [],
    service: withService ? (lang.completion?.service?.() ?? null) : null,
    triggerCharacters: lang.completion?.triggerCharacters ?? [],
  }
}

/**
 * The editor buffer a real editor would hold: what's on screen before the
 * caret, plus auto-inserted text after it. The rest of the snippet hasn't been
 * written yet, so it isn't there.
 */
export function bufferText(run: Run): { text: string; offset: number } {
  let text = ''
  let offset = 0
  for (let i = 0; i < run.chars.length; i++) {
    const s = run.states[i]
    const ch = s === 'ok' || s === 'bad' ? run.typed[i] : s === 'auto' || s === 'skipped' || s === 'pending' ? run.chars[i] : undefined
    if (ch === undefined) continue
    text += ch
    if (i < run.pos) offset = text.length
  }
  return { text, offset }
}

/** Filters and ranks a service's entries for the letters typed so far, as VS Code does. */
export function filterEntries(entries: ServiceEntry[], prefix: string): Suggestion[] {
  const out: (Suggestion & { sortText: string; name: string })[] = []
  for (const e of entries) {
    const m = fuzzyMatch(prefix, e.name)
    if (!m) continue
    out.push({
      label: e.optional ? `${e.name}?` : e.name,
      insertText: e.optional ? e.name : undefined,
      name: e.name,
      kind: e.kind,
      commit: e.commit,
      preselect: e.preselect,
      sortText: e.sortText,
      ...m,
    })
  }
  // VS Code: match score, then the service's sortText, then the label.
  out.sort((a, b) => b.score - a.score || a.sortText.localeCompare(b.sortText) || a.name.localeCompare(b.name))
  return out.slice(0, MAX_SUGGESTIONS)
}

/** The list is capped; VS Code shows a scrolling window onto it. */
export const MAX_SUGGESTIONS = 50

/** What's on screen at position i: the typed character, or an auto-inserted one. */
function charAt(run: Run, i: number): string | undefined {
  const s = run.states[i]
  if (s === 'ok' || s === 'bad') return run.typed[i]
  if (s === 'auto' || s === 'skipped') return run.chars[i]
  return undefined
}

/** Start of the word that ends at the caret, or -1 when the caret isn't right after a typed word. */
export function wordStart(run: Run, cfg: SuggestConfig): number {
  let i = run.pos
  while (i > 0 && run.typed[i - 1] !== undefined && cfg.wordChar.test(run.typed[i - 1]!)) i--
  if (i === run.pos) return -1
  // Words start with a non-digit, as in every language we expect to add.
  if (/\d/.test(run.typed[i]!)) return -1
  return i
}

export interface SuggestContext {
  /** Where the word being completed starts (equal to the caret right after a trigger). */
  start: number
  prefix: string
  /** Null for a plain word; for a member, the word before the trigger ("" when unknown, e.g. after ")"). */
  receiver: string | null
}

/** Is the text just before `end` one of the member triggers? Returns where the trigger starts. */
function triggerBefore(run: Run, end: number, cfg: SuggestConfig): number {
  for (const t of cfg.memberTriggers) {
    const from = end - t.length
    if (from < 0) continue
    let text = ''
    for (let i = from; i < end; i++) text += charAt(run, i) ?? '\0'
    if (text === t) return from
  }
  return -1
}

/** Works out what, if anything, can be completed at the caret. */
export function suggestContext(run: Run, cfg: SuggestConfig): SuggestContext | null {
  const ws = wordStart(run, cfg)
  const start = ws >= 0 ? ws : run.pos
  const prefix = run.typed.slice(start, run.pos).join('')

  const t = triggerBefore(run, start, cfg)
  if (t >= 0 && !cfg.quiet[t]) {
    // Allow optional chaining (a?.b) and chains continued on a new line (\n  .filter).
    let b = t - 1
    if (charAt(run, b) === '?') b--
    else while (b >= 0 && /\s/.test(charAt(run, b) ?? '')) b--
    const before = charAt(run, b)
    if (before !== undefined && cfg.wordChar.test(before)) {
      let r = b
      while (r > 0 && charAt(run, r - 1) !== undefined && cfg.wordChar.test(charAt(run, r - 1)!)) r--
      let receiver = ''
      for (let i = r; i <= b; i++) receiver += charAt(run, i)
      // "0.5" is a number, not a member access.
      if (!/^\d/.test(receiver)) return { start, prefix, receiver }
    } else if (before === ')' || before === ']') {
      return { start, prefix, receiver: '' }
    }
  }
  if (ws < 0 || cfg.quiet[ws]) return null
  return { start, prefix, receiver: null }
}

export function getSuggestions(run: Run, ctx: SuggestContext, cfg: SuggestConfig): Suggestion[] {
  const { prefix, receiver } = ctx
  if (!prefix && receiver === null) return []

  // First source to name a label wins, so built-in kinds beat plain words.
  const candidates = new Map<string, Item>()
  const add = (item: Item) => {
    if (!candidates.has(item.label)) candidates.set(item.label, item)
  }
  const known = receiver ? cfg.members.get(receiver) : undefined
  if (receiver === null) {
    for (const k of cfg.keywords) add({ label: k, kind: 'keyword' })
    for (const g of cfg.globals) add(g)
  } else if (known) {
    known.forEach(add)
  } else {
    ;(cfg.members.get('*') ?? []).forEach(add)
  }
  // Words already in the "document", like VS Code's word-based suggestions.
  // Not for a known receiver: TypeScript would list only its real members.
  if (!known) {
    let text = ''
    for (let i = 0; i < ctx.start; i++) text += charAt(run, i) ?? ''
    for (const [w] of text.matchAll(new RegExp(`${cfg.wordChar.source}+`, 'g'))) {
      // VS Code's word-based list leaves out the word being typed. In a member
      // list it stays, as TypeScript would list it, so a commit character never
      // swaps a finished name for a longer one.
      if (!/^\d/.test(w) && (w !== prefix || receiver !== null)) add({ label: w, kind: 'word' })
    }
  }

  const commit = receiver !== null && cfg.memberCommitCharacters.length ? cfg.memberCommitCharacters : undefined
  const out: Suggestion[] = []
  for (const item of candidates.values()) {
    const m = fuzzyMatch(prefix, item.label)
    if (m) out.push({ ...item, ...m, commit })
  }
  // Ties go the way TypeScript's sortText sends them in VS Code: names from the
  // file before globals and keywords, then alphabetical.
  const rank = (x: Suggestion) => (x.kind === 'word' ? 0 : 1)
  out.sort((a, b) => b.score - a.score || rank(a) - rank(b) || a.label.localeCompare(b.label))
  return out.slice(0, MAX_SUGGESTIONS)
}

const isUpper = (c: string) => c !== c.toLowerCase() && c === c.toUpperCase()

/** Word start, camelCase hump, or right after _ / $. */
function isStrong(word: string, i: number) {
  if (i === 0) return true
  const prev = word[i - 1]
  return (isUpper(word[i]) && !isUpper(prev)) || prev === '_' || prev === '$'
}

/**
 * Fuzzy match in the spirit of VS Code's fuzzyScore: every typed letter must
 * appear in order, the first one at a strong position. Runs of consecutive
 * letters, strong positions and exact case score higher.
 */
export function fuzzyMatch(pattern: string, word: string): { score: number; matches: number[] } | null {
  const P = pattern.length
  const W = word.length
  if (P === 0) return { score: 0, matches: [] }
  if (P > W) return null
  const lp = pattern.toLowerCase()
  const lw = word.toLowerCase()

  // best[i][j]: best score matching pattern[i..] with pattern[i] placed at word[j].
  const NONE = -Infinity
  const best: number[][] = Array.from({ length: P }, () => new Array<number>(W).fill(NONE))
  const next: number[][] = Array.from({ length: P }, () => new Array<number>(W).fill(-1))
  for (let i = P - 1; i >= 0; i--) {
    for (let j = W - P + i; j >= i; j--) {
      if (lp[i] !== lw[j]) continue
      if (i === 0 && !isStrong(word, j)) continue
      let s = 1 + (isStrong(word, j) ? 6 : 0) + (pattern[i] === word[j] ? 1 : 0)
      if (i === P - 1) {
        best[i][j] = s
        continue
      }
      let bestRest = NONE
      let bestK = -1
      for (let k = j + 1; k < W; k++) {
        const r = best[i + 1][k]
        if (r === NONE) continue
        // Consecutive letters beat jumping to a hump, so "fi" prefers filter over findIndex.
        const v = r + (k === j + 1 ? 9 : 0)
        if (v > bestRest) {
          bestRest = v
          bestK = k
        }
      }
      if (bestK < 0) continue
      s += bestRest
      best[i][j] = s
      next[i][j] = bestK
    }
  }
  let start = -1
  let score = NONE
  for (let j = 0; j < W; j++) {
    if (best[0][j] > score) {
      score = best[0][j]
      start = j
    }
  }
  if (start < 0) return null
  const matches: number[] = []
  for (let i = 0, j = start; i < P; j = next[i][j], i++) matches.push(j)
  // A match from the very first letter reads as a prefix; favour it like VS Code does.
  if (start === 0) score += 4
  // VS Code's boostFullMatch: the whole word typed beats longer words it's a prefix of,
  // so a commit character after "fetch" commits fetch, not fetchUser.
  if (P === W) score += 3
  return { score, matches }
}
