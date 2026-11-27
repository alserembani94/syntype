import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('printf puts', 'function'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** A standard header's names, on when the snippet has `#include <name.h>`. */
function header(name: string, globals: CompletionItem[]): VocabularyPack {
  return { name: `${name}.h`, detect: new RegExp(`^\\s*#\\s*include\\s*<${name}\\.h>`, 'm'), globals }
}

export const packs: VocabularyPack[] = [
  header('stdio', [
    ...items('printf fprintf sprintf snprintf puts fputs putchar fputc scanf sscanf fgets fgetc getchar', 'function'),
    ...items('fopen fclose fread fwrite fflush fseek ftell rewind feof ferror perror remove rename', 'function'),
    ...items('stdin stdout stderr EOF BUFSIZ SEEK_SET SEEK_CUR SEEK_END', 'variable'),
    ...items('FILE', 'type'),
  ]),
  header('stdlib', [
    ...items('malloc calloc realloc free exit abort atexit getenv system qsort bsearch', 'function'),
    ...items('abs labs atoi atol strtol strtoul strtod rand srand', 'function'),
    ...items('EXIT_SUCCESS EXIT_FAILURE RAND_MAX', 'variable'),
  ]),
  header(
    'string',
    items(
      'strlen strcmp strncmp strcpy strncpy strcat strncat strchr strrchr strstr strtok strdup strspn strcspn memcpy memmove memset memcmp memchr',
      'function',
    ),
  ),
  header('ctype', items('isspace isalpha isdigit isalnum isupper islower ispunct isxdigit toupper tolower', 'function')),
  header('math', [
    ...items('sqrt pow fabs floor ceil round fmod exp log log10 log2 sin cos tan atan2 hypot fmin fmax', 'function'),
    ...items('M_PI INFINITY NAN HUGE_VAL', 'variable'),
  ]),
  header('stdbool', [...items('bool', 'type'), ...items('true false', 'keyword')]),
  header('stdint', [
    ...items('int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t intptr_t uintptr_t', 'type'),
    ...items('INT8_MAX INT16_MAX INT32_MAX INT64_MAX UINT8_MAX UINT16_MAX UINT32_MAX UINT64_MAX SIZE_MAX', 'variable'),
  ]),
  header('stddef', [...items('size_t ptrdiff_t', 'type'), ...items('NULL offsetof', 'variable')]),
  header('assert', items('assert static_assert', 'function')),
  header('errno', items('errno EINVAL ENOMEM ERANGE ENOENT', 'variable')),
  header('limits', items('INT_MAX INT_MIN UINT_MAX LONG_MAX LONG_MIN CHAR_BIT CHAR_MAX', 'variable')),
]
