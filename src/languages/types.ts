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
  packs?: VocabularyPack[]
  /**
   * Characters that accept the selected item in a member list and are then
   * typed, like VS Code's commit characters. Only member lists use them here,
   * because without a service we can't tell when a new name is being declared.
   */
  memberCommitCharacters?: string[]
  /**
   * A real language service (e.g. TypeScript's). Started lazily; until it's
   * ready, and if it fails, suggestions fall back to the packs above.
   */
  service?: () => CompletionService
  /** Characters that ask the service for suggestions, e.g. "." or a quote. */
  triggerCharacters?: string[]
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
  completion?: CompletionConfig
  snippets: Snippet[]
}
