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
  /** Match keywords and types regardless of case, as SQL does. */
  caseInsensitive?: boolean
  /** Built-in type names, coloured as types (e.g. SQL's integer, text, jsonb). */
  types?: string[]
  /**
   * Colour capitalised names as types (Promise, Vec). On by default; off for
   * languages written in uppercase throughout, like COBOL.
   */
  capitalizedTypes?: boolean
  /** What an identifier looks like, as a RegExp source. Defaults to [A-Za-z_$][\w$]*; COBOL's include hyphens. */
  identifier?: string
  /** Line comment starters, e.g. ["//"] or ["#"]. */
  lineComments?: string[]
  /** Block comment pairs, e.g. [["/*", "*\/"]]. */
  blockComments?: [string, string][]
  /** Quote delimiters that stay on one line, e.g. ['"', "'"]. */
  strings?: string[]
  /** Quote delimiters that may span lines, e.g. ["`"] or ['"""']. */
  multilineStrings?: string[]
  /**
   * Coloured as keys: the first capture group of each match, e.g. YAML's
   * `runs-on` in `runs-on: ubuntu-latest`. Must be a global, multiline RegExp.
   */
  keyPattern?: RegExp
}

/** Same shape as VS Code's language-configuration `autoClosingPairs`. */
export interface AutoClosingPair {
  open: string
  close: string
  notIn?: ('string' | 'comment')[]
}

import type { CompletionService } from '../lib/service'

/** Kinds of suggestion, shown as icons like VS Code's. */
export type SuggestionKind =
  | 'keyword'
  | 'word'
  | 'function'
  | 'method'
  | 'variable'
  | 'class'
  | 'property'
  | 'module'
  | 'interface'
  | 'type'
  | 'enum'
  | 'enumMember'
  | 'typeParameter'
  | 'string'

export interface CompletionItem {
  label: string
  kind: SuggestionKind
}

/**
 * A vocabulary: what the language or a library provides. A pack without
 * `detect` is always on (built-ins); one with `detect` switches on when the
 * snippet matches it, e.g. when it imports the library.
 */
export interface VocabularyPack {
  /** Shown next to the suggestion, e.g. "react". */
  name: string
  detect?: RegExp
  /** Suggested anywhere a word starts. */
  globals?: CompletionItem[]
  /**
   * Suggested after a member trigger such as ".", keyed by the word before it
   * (e.g. "Math"). "*" lists members for receivers we don't know.
   */
  members?: Record<string, CompletionItem[]>
}

/**
 * Constrained IntelliSense for a language. Keywords come from `highlight`;
 * words the user has typed are added automatically.
 */
export interface CompletionConfig {
  /** A single word character, e.g. /[\w$]/ for JavaScript or /[\w-]/ for CSS. Defaults to /[\w$]/. */
  wordChar?: RegExp
  /** What opens member suggestions, e.g. ["."] or ["::", "->"]. Defaults to ["."]. */
  memberTriggers?: string[]
  /** Vocabulary for languages without a service (JavaScript and TypeScript have one). */
  packs?: VocabularyPack[]
  /**
   * A real language service (e.g. TypeScript's). Started lazily; until it's
   * ready, and if it fails, suggestions fall back to keywords, packs and typed words.
   */
  service?: () => CompletionService
  /** Characters that ask the service for suggestions, e.g. "." or a quote. */
  triggerCharacters?: string[]
  /** Passed to the service with each request, for services that handle several languages. */
  serviceMode?: string
}

export interface Language {
  /** Stable id, used in storage keys. */
  id: string
  /** Display name, e.g. "JavaScript". */
  name: string
  /** File extension without the dot, e.g. "js". */
  extension: string
  highlight: HighlightRules
  /** Width of one indentation level: spaces per level, or how wide a tab displays. Defaults to 2. */
  indentSize?: number
  /** Indent with tab characters (gofmt) instead of spaces. */
  indentWithTabs?: boolean
  /** Columns before the first indentation level: 7 for fixed-format COBOL, whose code starts at column 8. */
  indentOffset?: number
  /** Longest line the language allows, when shorter than the general limit (COBOL: 72). */
  maxLineLength?: number
  /** What auto-closes, as in VS Code. Defaults to (), [] and {}. */
  autoClosingPairs?: AutoClosingPair[]
  /** Characters after the caret that allow auto-closing. Defaults to VS Code's. */
  autoCloseBefore?: string
  completion?: CompletionConfig
  snippets: Snippet[]
}
