import type { AutoClosingPair, HighlightRules } from '../languages/types'
import { tokens } from './tokenize'

/** VS Code's default `autoCloseBefore`: only auto-close when the next character is one of these. */
const DEFAULT_AUTO_CLOSE_BEFORE = ';:.,=}])> \n\t'

const DEFAULT_AUTO_CLOSING_PAIRS: AutoClosingPair[] = [
  { open: '{', close: '}' },
  { open: '[', close: ']' },
  { open: '(', close: ')' },
]

/** Precomputed, per snippet: which opener closes where, and whether VS Code would auto-close it. */
export interface Pairs {
  /** Index of the matching closer for an opener, or -1. */
  closeOf: number[]
  /** Static VS Code rules for this opener: `notIn` and "no quote right after a word character". */
  allowed: boolean[]
  /** Characters that may follow the caret for auto-close to happen. */
  autoCloseBefore: string
}

interface PairSource {
  highlight: HighlightRules
  autoClosingPairs?: AutoClosingPair[]
  autoCloseBefore?: string
}

/**
 * Matches brackets and quotes in a snippet. Brackets are matched within their
 * own scope: code, or the inside of one string or comment, so a ")" in a string
 * never pairs with a "(" in code. Unbalanced brackets are left unpaired.
 */
export function computePairs(code: string, lang: PairSource): Pairs {
  const n = code.length
  const pairs = lang.autoClosingPairs ?? DEFAULT_AUTO_CLOSING_PAIRS
  const closeOf = new Array<number>(n).fill(-1)
  const allowed = new Array<boolean>(n).fill(false)

  const toks = tokens(code, lang.highlight)
  // Which string/comment token (if any) each character belongs to.
  const scopeOf = new Array<number>(n).fill(-1)
  toks.forEach((t, i) => {
    if (t.cls === 'str' || t.cls === 'com') scopeOf.fill(i, t.start, t.end)
  })

  const brackets = pairs.filter((p) => p.open.length === 1 && p.open !== p.close)
  const quotes = pairs.filter((p) => p.open.length === 1 && p.open === p.close)
  const closeToOpen = new Map(brackets.map((p) => [p.close, p.open]))
  const isOpen = new Set(brackets.map((p) => p.open))

  // Brackets, one stack per scope.
  const stacks = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const ch = code[i]
    const scope = scopeOf[i]
    // A string's own delimiters are not brackets.
    if (scope >= 0 && (i === toks[scope].start || i === toks[scope].end - 1) && toks[scope].cls === 'str') continue
    let stack = stacks.get(scope)
    if (!stack) stacks.set(scope, (stack = []))
    if (isOpen.has(ch)) stack.push(i)
    else if (closeToOpen.has(ch)) {
      const top = stack.at(-1)
      if (top !== undefined && code[top] === closeToOpen.get(ch)) {
        stack.pop()
        closeOf[top] = i
      }
    }
  }

  // Quotes: a string token's first and last character. Triple-quoted strings
  // (""""doc"""") have no auto-closing pair in VS Code, so they're left alone.
  const quoteChars = new Set(pairs.filter((p) => p.close.length === 1 && p.open.endsWith(p.close)).map((p) => p.close))
  for (const t of toks) {
    if (t.cls !== 'str' || t.end - t.start < 2) continue
    const q = code[t.start]
    if (code.startsWith(q.repeat(3), t.start)) continue
    if (code[t.end - 1] === q && (quotes.some((p) => p.open === q) || quoteChars.has(q))) closeOf[t.start] = t.end - 1
  }

  // VS Code's static rules. Like VS Code, use the longest pair whose opener ends
  // at this character, so a Python prefix such as f" wins over a bare ".
  for (let i = 0; i < n; i++) {
    if (closeOf[i] < 0) continue
    const p = pairs
      .filter((c) => c.open.endsWith(code[i]) && code.slice(i - c.open.length + 1, i + 1) === c.open)
      .sort((a, b) => b.open.length - a.open.length)[0]
    if (!p) continue
    const scope = scopeOf[i]
    const tok = scope >= 0 ? toks[scope] : null
    const inString = tok?.cls === 'str' && i !== tok.start
    const inComment = tok?.cls === 'com'
    let ok = !(p.notIn?.includes('string') && inString) && !(p.notIn?.includes('comment') && inComment)
    // VS Code never auto-closes a bare quote typed right after a word character;
    // a prefixed pair (f", r') exists precisely to allow it.
    if (p.open === p.close && i > 0 && /\w/.test(code[i - 1])) ok = false
    allowed[i] = ok
  }

  return { closeOf, allowed, autoCloseBefore: lang.autoCloseBefore ?? DEFAULT_AUTO_CLOSE_BEFORE }
}
