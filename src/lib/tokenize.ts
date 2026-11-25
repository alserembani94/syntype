import type { HighlightRules } from '../languages/types'

export type TokenClass = '' | 'kw' | 'str' | 'num' | 'fn' | 'ty' | 'com' | 'pun'

export interface Token {
  start: number
  /** Exclusive. */
  end: number
  cls: TokenClass
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

function buildRegex(rules: HighlightRules): RegExp {
  const comments = [
    ...(rules.lineComments ?? []).map((c) => `${esc(c)}[^\\n]*`),
    ...(rules.blockComments ?? []).map(([a, b]) => `${esc(a)}[\\s\\S]*?${esc(b)}`),
  ]
  const strings = [
    // Longest delimiters first, so """ wins over ".
    ...(rules.multilineStrings ?? []).map((d) => [d, true] as const),
    ...(rules.strings ?? []).map((d) => [d, false] as const),
  ]
    .sort((a, b) => b[0].length - a[0].length)
    .map(([d, multi]) => {
      const q = esc(d)
      return `${q}(?:\\\\[\\s\\S]|(?!${q})${multi ? '[\\s\\S]' : '[^\\n\\\\]'})*${q}`
    })
  const group = (parts: string[]) => `(${parts.length ? parts.join('|') : '(?!)'})`
  return new RegExp(
    [
      group(comments),
      group(strings),
      '(\\b\\d+(?:\\.\\d+)?\\b)',
      `(${rules.identifier ?? '[A-Za-z_$][\\w$]*'})`,
      '([^\\sA-Za-z0-9_$])',
    ].join('|'),
    'g',
  )
}

const cache = new WeakMap<HighlightRules, { re: RegExp; keywords: Set<string>; types: Set<string> }>()

/** Splits `code` into coloured tokens using the language's rules. Whitespace is not tokenized. */
export function tokens(code: string, rules: HighlightRules): Token[] {
  let compiled = cache.get(rules)
  if (!compiled) {
    const norm = (w: string) => (rules.caseInsensitive ? w.toLowerCase() : w)
    compiled = { re: buildRegex(rules), keywords: new Set(rules.keywords.map(norm)), types: new Set((rules.types ?? []).map(norm)) }
    cache.set(rules, compiled)
  }
  const { keywords, types } = compiled
  const re = new RegExp(compiled.re)
  const out: Token[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    let cls: TokenClass = ''
    if (m[1]) cls = 'com'
    else if (m[2]) cls = 'str'
    else if (m[3]) cls = 'num'
    else if (m[4]) {
      const word = rules.caseInsensitive ? m[4].toLowerCase() : m[4]
      if (keywords.has(word)) cls = 'kw'
      else if (types.has(word)) cls = 'ty'
      else if (code[re.lastIndex] === '(') cls = 'fn'
      else if (rules.capitalizedTypes !== false && /^[A-Z]/.test(m[4])) cls = 'ty'
    } else if (m[5]) cls = 'pun'
    out.push({ start: m.index, end: re.lastIndex, cls })
  }
  return out
}

/** Returns one token class per character of `code`. */
export function tokenize(code: string, rules: HighlightRules): TokenClass[] {
  const classes: TokenClass[] = new Array(code.length).fill('')
  for (const t of tokens(code, rules)) classes.fill(t.cls, t.start, t.end)
  if (rules.keyPattern) {
    for (const m of code.matchAll(rules.keyPattern)) {
      if (m[1] === undefined || m.index === undefined) continue
      const start = m.index + m[0].indexOf(m[1])
      // Keys inside comments and strings stay as they are.
      if (classes[start] === 'com' || classes[start] === 'str') continue
      classes.fill('fn', start, start + m[1].length)
    }
  }
  return classes
}
