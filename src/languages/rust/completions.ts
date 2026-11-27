import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('iter map collect', 'method'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** Matches `use std::<module>` (including `use std::<module>::{...}`). */
const uses = (module: string) => new RegExp(`^\\s*use\\s+std::${module}\\b`, 'm')

/** The prelude, primitive types and common macros: always available. */
const prelude: VocabularyPack = {
  name: 'std',
  globals: [
    ...items('Vec String Option Result Box Iterator IntoIterator Clone Copy Debug Default PartialEq Eq Hash From Into', 'class'),
    ...items('Some None Ok Err', 'enumMember'),
    ...items('i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize f32 f64 bool char str', 'type'),
    // Macros: type the name, then "!".
    ...items('println print eprintln format vec assert assert_eq panic todo unreachable matches dbg write writeln', 'function'),
    { label: 'std', kind: 'module' },
  ],
  members: {
    // After "Type::" for prelude types.
    String: items('new from with_capacity from_utf8', 'function'),
    Vec: items('new with_capacity from', 'function'),
    Box: items('new', 'function'),
    // Without a language service the type after "." is unknown, so these
    // common methods of iterators, strings, collections, Option and Result are offered.
    '*': [
      ...items(
        'iter iter_mut into_iter map filter filter_map flat_map collect fold sum count enumerate zip rev take skip chain find position any all max min max_by_key min_by_key for_each peekable',
        'method',
      ),
      ...items(
        'len is_empty push pop insert remove get get_mut contains clear extend sort sort_by sort_by_key dedup retain first last join split split_once split_whitespace trim lines chars bytes to_string to_owned as_str to_uppercase to_lowercase starts_with ends_with parse',
        'method',
      ),
      ...items(
        'unwrap unwrap_or unwrap_or_else unwrap_or_default expect ok_or map_err and_then is_some is_none is_ok is_err clone entry or_insert or_default keys values as_ref lock',
        'method',
      ),
    ],
  },
}

const collections: VocabularyPack = {
  name: 'std::collections',
  detect: uses('collections'),
  globals: items('HashMap HashSet BTreeMap BTreeSet VecDeque', 'class'),
  members: {
    HashMap: items('new with_capacity from', 'function'),
    HashSet: items('new with_capacity from', 'function'),
    BTreeMap: items('new from', 'function'),
    VecDeque: items('new with_capacity from', 'function'),
  },
}

const module = (name: string, members: CompletionItem[]): VocabularyPack => ({
  name: `std::${name}`,
  detect: uses(name),
  globals: [{ label: name, kind: 'module' }],
  members: { [name]: members },
})

export const packs: VocabularyPack[] = [
  prelude,
  collections,
  module('fs', items('read_to_string write read create_dir_all remove_file File', 'function')),
  module('io', items('stdin stdout Read Write BufRead BufReader Result Error ErrorKind', 'class')),
  module('fmt', items('Display Debug Formatter Result Write', 'class')),
  module('thread', items('spawn sleep scope current', 'function')),
  {
    name: 'std::sync',
    detect: uses('sync'),
    globals: items('Arc Mutex RwLock mpsc', 'class'),
    members: {
      Arc: items('new clone strong_count', 'function'),
      Mutex: items('new', 'function'),
      RwLock: items('new', 'function'),
    },
  },
]
