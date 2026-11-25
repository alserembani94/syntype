export type SnippetLength = 'short' | 'medium' | 'long'
export type LengthFilter = SnippetLength | 'any'

export interface Snippet {
  /** Shown as the editor tab, e.g. "debounce.js". */
  name: string
  code: string
  length: SnippetLength
}

/** How to colour a language. Everything is optional except keywords. */
export interface HighlightRules {
  keywords: string[]
  /** Line comment starters, e.g. ["//"] or ["#"]. */
  lineComments?: string[]
  /** Block comment pairs, e.g. [["/*", "*\/"]]. */
  blockComments?: [string, string][]
  /** Quote delimiters that stay on one line, e.g. ['"', "'"]. */
  strings?: string[]
  /** Quote delimiters that may span lines, e.g. ["`"] or ['"""']. */
  multilineStrings?: string[]
}

/** Same shape as VS Code's language-configuration `autoClosingPairs`. */
export interface AutoClosingPair {
  open: string
  close: string
  notIn?: ('string' | 'comment')[]
}

export interface Language {
  /** Stable id, used in storage keys. */
  id: string
  /** Display name, e.g. "JavaScript". */
  name: string
  /** File extension without the dot, e.g. "js". */
  extension: string
  highlight: HighlightRules
  /** What auto-closes, as in VS Code. Defaults to (), [] and {}. */
  autoClosingPairs?: AutoClosingPair[]
  /** Characters after the caret that allow auto-closing. Defaults to VS Code's. */
  autoCloseBefore?: string
  snippets: Snippet[]
}
