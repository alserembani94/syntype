import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('count sum', 'function'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

export const TYPES =
  'integer int smallint bigint serial bigserial numeric decimal real text varchar char boolean bool date time timestamp timestamptz interval uuid json jsonb bytea'

/** PostgreSQL's built-in functions and types. Columns and tables come from words typed earlier. */
export const builtins: VocabularyPack = {
  name: 'PostgreSQL',
  globals: [
    ...items(
      'now count sum avg min max repeat coalesce nullif greatest least lower upper length trim concat string_agg array_agg json_agg jsonb_agg jsonb_build_object to_char date_trunc extract generate_series row_number rank dense_rank lag lead gen_random_uuid round floor ceil abs current_date current_timestamp',
      'function',
    ),
    ...items(TYPES, 'type'),
  ],
}

export const packs: VocabularyPack[] = [builtins]
