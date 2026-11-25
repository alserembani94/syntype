import { javascript } from './javascript'
import { typescript } from './typescript'
import type { Language } from './types'

/**
 * Every language the game offers. To add one, create a folder next to
 * `javascript/` with a snippets.txt and an index.ts, then list it here.
 */
export const LANGUAGES: Language[] = [javascript, typescript]

export function getLanguage(id: string): Language {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]
}

export type { Language, LengthFilter, Snippet, SnippetLength, HighlightRules, AutoClosingPair, CompletionConfig, CompletionItem, SuggestionKind, VocabularyPack } from './types'
export { pickSnippet } from './snippets'
