import type { Snippet, SnippetLength } from './types'

/**
 * Parses a snippets file: each snippet starts with a `=== file-name` line,
 * followed by its code. Length is bucketed by character count.
 */
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

/** Random snippet of the given length, avoiding a repeat where possible. */
export function pickSnippet(snippets: Snippet[], length: SnippetLength, avoid?: string): Snippet {
  let pool = snippets.filter((s) => s.length === length)
  if (!pool.length) pool = snippets
  if (pool.length > 1 && avoid) pool = pool.filter((s) => s.name !== avoid)
  return pool[Math.floor(Math.random() * pool.length)]
}
