import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('Println Printf', 'function'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/**
 * A standard-library package, on when the snippet imports it, either as
 * `import "fmt"` or inside an `import ( ... )` block. Its members are offered
 * after its name, which is the last part of its path: "net/http" → `http.`.
 */
function pkg(path: string, members: CompletionItem[]): VocabularyPack {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return {
    name: path,
    detect: new RegExp(`^\\s*(?:import\\s+)?"${path.replace('/', '\\/')}"`, 'm'),
    globals: [{ label: name, kind: 'module' }],
    members: { [name]: members },
  }
}

const builtins: VocabularyPack = {
  name: 'Go',
  globals: [
    ...items('len cap make new append copy delete panic recover close min max clear print println', 'function'),
    ...items('int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error any', 'type'),
  ],
  members: {
    // We can't know a value's type without a language service, so after any
    // other "." these common methods are offered.
    '*': items(
      'Error String Len Lock Unlock RLock RUnlock Add Done Wait Close Read Write WriteString Scan Text Err Encode Decode Header Set Get Value Deadline',
      'method',
    ),
  },
}

export const packs: VocabularyPack[] = [
  builtins,
  pkg('fmt', items('Println Printf Print Sprintf Sprint Sprintln Errorf Fprintf Fprintln Sscanf Stringer', 'function')),
  pkg(
    'strings',
    items(
      'Split Join Contains HasPrefix HasSuffix TrimSpace Trim TrimPrefix TrimSuffix ToLower ToUpper Fields Repeat ReplaceAll Index EqualFold Builder NewReader',
      'function',
    ),
  ),
  pkg('strconv', items('Itoa Atoi ParseInt ParseFloat ParseBool FormatInt FormatFloat Quote', 'function')),
  pkg('errors', items('New Is As Join Unwrap', 'function')),
  pkg('os', items('Open Create ReadFile WriteFile Getenv Setenv Exit Args Stdin Stdout Stderr Remove MkdirAll', 'function')),
  pkg('sync', items('WaitGroup Mutex RWMutex Once Map Pool', 'class')),
  pkg('time', [
    ...items('Now Since Until Sleep After Tick NewTimer NewTicker Parse ParseDuration', 'function'),
    ...items('Duration Time Nanosecond Microsecond Millisecond Second Minute Hour', 'type'),
  ]),
  pkg('net/http', [
    ...items('HandleFunc Handle ListenAndServe Get Post NewRequest NewServeMux Error NotFound', 'function'),
    ...items('ResponseWriter Request Handler Client Server', 'type'),
    ...items('StatusOK StatusCreated StatusBadRequest StatusNotFound StatusInternalServerError MethodGet MethodPost', 'variable'),
  ]),
  pkg('encoding/json', items('Marshal MarshalIndent Unmarshal NewDecoder NewEncoder Valid RawMessage', 'function')),
  pkg('context', items('Background TODO WithCancel WithTimeout WithDeadline WithValue Context', 'function')),
  pkg('io', items('Reader Writer ReadAll Copy EOF Discard NopCloser', 'function')),
  pkg('bufio', items('NewScanner NewReader NewWriter ScanLines ScanWords Scanner', 'function')),
  pkg('sort', items('Slice SliceStable Ints Strings Search', 'function')),
  pkg('slices', items('Sort SortFunc Contains Index Reverse Max Min Equal BinarySearch', 'function')),
  pkg('maps', items('Keys Values Clone Copy Equal', 'function')),
  pkg('math', [...items('Sqrt Pow Abs Floor Ceil Max Min Hypot Round Inf', 'function'), ...items('Pi E MaxInt MinInt', 'variable')]),
]
