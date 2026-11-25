export type TokenClass = '' | 'kw' | 'str' | 'num' | 'fn' | 'ty' | 'com' | 'pun'

const KEYWORDS = new Set(
  'const let var function return if else for while do switch case default break continue new class extends super this import export from as async await try catch finally throw typeof instanceof in of null undefined true false void delete yield get set static'.split(
    ' ',
  ),
)

const TOKEN_RE =
  /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|([^\sA-Za-z0-9_$])/g

/** A small JS highlighter: returns one token class per character of `code`. */
export function tokenize(code: string): TokenClass[] {
  const classes: TokenClass[] = new Array(code.length).fill('')
  const re = new RegExp(TOKEN_RE)
  let m: RegExpExecArray | null
  while ((m = re.exec(code))) {
    let c: TokenClass = ''
    if (m[1] || m[2]) c = 'com'
    else if (m[3]) c = 'str'
    else if (m[4]) c = 'num'
    else if (m[5]) {
      if (KEYWORDS.has(m[5])) c = 'kw'
      else if (code[re.lastIndex] === '(') c = 'fn'
      else if (/^[A-Z]/.test(m[5])) c = 'ty'
    } else if (m[6]) c = 'pun'
    for (let i = m.index; i < re.lastIndex; i++) classes[i] = c
  }
  return classes
}
