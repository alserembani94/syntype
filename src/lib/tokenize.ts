import type { HighlightRules } from '../languages/types'

export type TokenClass = '' | 'kw' | 'str' | 'num' | 'fn' | 'ty' | 'com' | 'pun'

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
    [group(comments), group(strings), '(\\b\\d+(?:\\.\\d+)?\\b)', '([A-Za-z_$][\\w$]*)', '([^\\sA-Za-z0-9_$])'].join('|'),
    'g',
  )
}

const cache = new WeakMap<HighlightRules, { re: RegExp; keywords: Set<string> }>()

/** Returns one token class per character of `code`, using the language's rules. */
export function tokenize(code: string, rules: HighlightRules): TokenClass[] {
  let compiled = cache.get(rules)
  if (!compiled) {
    compiled = { re: buildRegex(rules), keywords: new Set(rules.keywords) }
    cache.set(rules, compiled)
  }
  const { keywords } = compiled
  const re = new RegExp(compiled.re)
  const classes: TokenClass[] = new Array(code.length).fill('')
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    let c: TokenClass = ''
    if (m[1]) c = 'com'
    else if (m[2]) c = 'str'
    else if (m[3]) c = 'num'
    else if (m[4]) {
      if (keywords.has(m[4])) c = 'kw'
      else if (code[re.lastIndex] === '(') c = 'fn'
      else if (/^[A-Z]/.test(m[4])) c = 'ty'
    } else if (m[5]) c = 'pun'
    for (let i = m.index; i < re.lastIndex; i++) classes[i] = c
  }
  return classes
}
