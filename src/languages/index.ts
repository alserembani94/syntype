import { javascript } from './javascript'
import { typescript } from './typescript'
import { python } from './python'
import { rust } from './rust'
import { go } from './go'
import { php } from './php'
import { yaml } from './yaml'
import { postgresql } from './postgresql'
import { cobol } from './cobol'
import { assembly } from './assembly'
import { brainfuck } from './brainfuck'
import { lolcode } from './lolcode'
import { playwright } from './playwright'
import { selenium } from './selenium'
import { pytest } from './pytest'
import type { Language } from './types'

/**
 * Every language the game offers. To add one, create a folder next to
 * `javascript/` with a snippets.txt and an index.ts, then list it here.
 */
export const LANGUAGES: Language[] = [javascript, typescript, python, rust, go, assembly, php, yaml, postgresql, cobol, brainfuck, lolcode, playwright, selenium, pytest]

export function getLanguage(id: string): Language {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0]
}

export { CATEGORIES } from './types'
export type { Language, LanguageCategory, LengthFilter, Snippet, SnippetLength, HighlightRules, AutoClosingPair, CompletionConfig, CompletionItem, SuggestionKind, VocabularyPack } from './types'
export { pickSnippet } from './snippets'
