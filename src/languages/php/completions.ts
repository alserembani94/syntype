import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('count strlen', 'function'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** PHP's built-in functions, classes and constants: always available, no imports. */
const builtins: VocabularyPack = {
  name: 'PHP',
  globals: [
    ...items(
      'count strlen str_replace str_contains str_starts_with str_ends_with explode implode trim strtolower strtoupper ucfirst sprintf printf number_format',
      'function',
    ),
    ...items(
      'array_map array_filter array_reduce array_keys array_values array_merge array_slice array_sum array_column array_pop array_push array_key_exists array_key_last in_array range usort sort',
      'function',
    ),
    ...items(
      'json_encode json_decode file_get_contents file_put_contents preg_match preg_replace preg_split htmlspecialchars intval is_array is_string max min round sqrt date time header http_response_code var_dump print_r',
      'function',
    ),
    ...items(
      'Exception RuntimeException InvalidArgumentException LogicException UnderflowException DateTimeImmutable DateTime Closure PDO stdClass ArrayObject',
      'class',
    ),
    ...items('JSON_THROW_ON_ERROR JSON_PRETTY_PRINT PHP_EOL M_PI', 'variable'),
  ],
  members: {
    // After "Class::".
    PDO: items('FETCH_ASSOC FETCH_OBJ ATTR_ERRMODE ERRMODE_EXCEPTION', 'variable'),
    // Without a language service the object's class is unknown, so after "->"
    // these common methods (PDO, exceptions, dates) are offered alongside typed words.
    '*': items('prepare execute fetch fetchAll query getMessage getCode format modify getTimestamp', 'method'),
  },
}

export const packs: VocabularyPack[] = [builtins]
