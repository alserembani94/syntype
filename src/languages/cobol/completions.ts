import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('UPPER-CASE TRIM', 'function'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** Intrinsic functions, written after the FUNCTION keyword. Data names come from words typed earlier. */
export const intrinsics: VocabularyPack = {
  name: 'COBOL',
  globals: items(
    'CURRENT-DATE UPPER-CASE LOWER-CASE LENGTH NUMVAL NUMVAL-C TRIM REVERSE MOD REM INTEGER INTEGER-PART MAX MIN SUM MEAN MEDIAN RANDOM SQRT ORD CHAR WHEN-COMPILED',
    'function',
  ),
}

export const packs: VocabularyPack[] = [intrinsics]
