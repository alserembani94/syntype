/**
 * Constrained IntelliSense: suggestions built only from what we know about the
 * snippet's language and from what the user has typed so far. Pure functions,
 * no React. Behaviour follows VS Code's defaults:
 * - quickSuggestions: on in code, off in strings and comments
 * - word-based words leave out the word being typed and numbers
 * - fuzzy matching where the first letter must hit a word start or camelCase hump
 */
import type { Run } from './engine'
import type { Language } from '../languages/types'
import { tokenize } from './tokenize'

export type SuggestionKind = 'keyword' | 'word'

export interface Suggestion {
  label: string
  kind: SuggestionKind
  score: number
  /** Indexes into label that matched the typed letters, for highlighting. */
  matches: number[]
}

export interface SuggestConfig {
  keywords: string[]
  /** Which characters make up a word in this language. */
  wordChar: RegExp
  /** Per snippet position: true inside strings and comments, where VS Code shows no quick suggestions. */
  quiet: boolean[]
}

/** Builds the suggestion setup for one snippet in one language. */
export function buildSuggestConfig(code: string, lang: Language): SuggestConfig {
  const classes = tokenize(code, lang.highlight)
  return {
    keywords: lang.highlight.keywords,
    wordChar: lang.completion?.wordChar ?? /[\w$]/,
    quiet: classes.map((c) => c === 'str' || c === 'com'),
  }
}

/** VS Code shows at most this many rows at once; we cap the list itself a bit higher. */
export const MAX_SUGGESTIONS = 50

/** Start of the word that ends at the caret, or -1 when the caret isn't right after a typed word. */
export function wordStart(run: Run, cfg: SuggestConfig): number {
  let i = run.pos
  while (i > 0 && run.typed[i - 1] !== undefined && cfg.wordChar.test(run.typed[i - 1]!)) i--
  if (i === run.pos) return -1
  // Words start with a non-digit, as in every language we expect to add.
  if (/\d/.test(run.typed[i]!)) return -1
  return i
}

/** The text currently on screen before `end`: typed characters plus auto-inserted ones. */
function textBefore(run: Run, end: number): string {
  let out = ''
  for (let i = 0; i < end; i++) {
    const s = run.states[i]
    if (s === 'ok' || s === 'bad') out += run.typed[i]
    else if (s === 'auto' || s === 'skipped') out += run.chars[i]
  }
  return out
}

/** Whether suggestions should open for a word starting at `start`. */
export const canSuggestAt = (cfg: SuggestConfig, start: number) => start >= 0 && !cfg.quiet[start]

export function getSuggestions(run: Run, start: number, cfg: SuggestConfig): Suggestion[] {
  const prefix = run.typed.slice(start, run.pos).join('')
  if (!prefix) return []

  const candidates = new Map<string, SuggestionKind>()
  for (const k of cfg.keywords) candidates.set(k, 'keyword')
  // Words already in the "document", like VS Code's word-based suggestions.
  const wordRe = new RegExp(`${cfg.wordChar.source}+`, 'g')
  for (const [w] of textBefore(run, start).matchAll(wordRe)) {
    if (/^\d/.test(w) || candidates.has(w)) continue
    candidates.set(w, 'word')
  }

  const out: Suggestion[] = []
  for (const [label, kind] of candidates) {
    // VS Code drops the word being typed from word-based results, but keywords stay.
    if (kind === 'word' && label === prefix) continue
    const m = fuzzyMatch(prefix, label)
    if (m) out.push({ label, kind, ...m })
  }
  out.sort((a, b) => b.score - a.score || a.label.length - b.label.length || a.label.localeCompare(b.label))
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
      let s = 1 + (isStrong(word, j) ? 8 : 0) + (pattern[i] === word[j] ? 1 : 0)
      if (i === P - 1) {
        best[i][j] = s
        continue
      }
      let bestRest = NONE
      let bestK = -1
      for (let k = j + 1; k < W; k++) {
        const r = best[i + 1][k]
        if (r === NONE) continue
        const v = r + (k === j + 1 ? 5 : 0)
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
  return { score, matches }
}
