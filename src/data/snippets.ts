import raw from './snippets.txt?raw'

export type SnippetLength = 'short' | 'medium' | 'long'
export type LengthFilter = SnippetLength | 'any'

export interface Snippet {
  name: string
  code: string
  length: SnippetLength
}

/** Snippets live in snippets.txt as `=== file.js` headers followed by code. */
export function parseSnippets(text: string): Snippet[] {
  return text
    .split(/^=== /m)
    .filter((block) => block.trim())
    .map((block) => {
      const nl = block.indexOf('\n')
      const code = block.slice(nl + 1).replace(/\s+$/, '')
      const n = code.length
      return {
        name: block.slice(0, nl).trim(),
        code,
        length: n < 120 ? 'short' : n <= 300 ? 'medium' : 'long',
      }
    })
}

export const SNIPPETS = parseSnippets(raw)

export function pickSnippet(filter: LengthFilter, avoid?: string): Snippet {
  let pool = SNIPPETS.filter((s) => filter === 'any' || s.length === filter)
  if (pool.length > 1 && avoid) pool = pool.filter((s) => s.name !== avoid)
  return pool[Math.floor(Math.random() * pool.length)]
}
