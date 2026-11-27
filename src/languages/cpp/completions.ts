import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('vector array', 'class'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** A standard header, on when the snippet has `#include <name>`: its names follow `std::`. */
function header(name: string, members: CompletionItem[], more: Record<string, CompletionItem[]> = {}): VocabularyPack {
  return { name: `<${name}>`, detect: new RegExp(`^\\s*#\\s*include\\s*<${name}>`, 'm'), members: { std: members, ...more } }
}

/** Always on: the std namespace itself, and methods offered after any "." or "->". */
const base: VocabularyPack = {
  name: 'C++',
  globals: [{ label: 'std', kind: 'module' }],
  members: {
    // Without a language service the type before "." is unknown, so these common methods of
    // the containers, strings, streams and smart pointers are offered.
    '*': [
      ...items(
        'push_back emplace_back pop_back push_front emplace_front pop_front insert emplace erase clear size empty resize reserve capacity front back begin end cbegin cend rbegin rend data at find count contains splice',
        'method',
      ),
      ...items('substr starts_with ends_with c_str length append compare', 'method'),
      ...items('get reset release value value_or has_value', 'method'),
      ...items('first second', 'property'),
    ],
  },
}

export const packs: VocabularyPack[] = [
  base,
  header('iostream', [...items('cout cin cerr clog endl', 'variable'), ...items('ostream istream', 'class')]),
  header('string', [...items('string', 'class'), ...items('to_string stoi stol stod getline', 'function')]),
  header('string_view', items('string_view', 'class')),
  header('vector', items('vector', 'class')),
  header('array', items('array', 'class')),
  header('list', items('list', 'class')),
  header('deque', items('deque', 'class')),
  header('map', items('map multimap', 'class')),
  header('set', items('set multiset', 'class')),
  header('unordered_map', items('unordered_map', 'class')),
  header('unordered_set', items('unordered_set', 'class')),
  header('utility', [...items('pair', 'class'), ...items('move forward swap exchange make_pair', 'function')]),
  header('tuple', [...items('tuple', 'class'), ...items('make_tuple tie get', 'function')]),
  header('optional', [...items('optional', 'class'), ...items('nullopt', 'variable'), ...items('make_optional', 'function')]),
  header('variant', [...items('variant monostate', 'class'), ...items('visit get get_if holds_alternative', 'function')]),
  header('memory', [...items('unique_ptr shared_ptr weak_ptr', 'class'), ...items('make_unique make_shared', 'function')]),
  header('functional', [...items('function', 'class'), ...items('invoke bind', 'function')]),
  header(
    'algorithm',
    [...items('sort stable_sort find find_if count count_if copy copy_if transform remove_if reverse min max clamp any_of all_of none_of for_each binary_search lower_bound unique', 'function'), ...items('ranges', 'module')],
    { ranges: items('sort find find_if count_if copy transform reverse min max any_of all_of none_of for_each', 'function') },
  ),
  header('numeric', items('accumulate reduce iota inner_product partial_sum', 'function')),
  header('ranges', [...items('ranges views', 'module')], { views: items('filter transform take drop reverse iota keys values', 'function') }),
  header('format', items('format format_to', 'function')),
  header('fstream', items('ifstream ofstream fstream', 'class')),
  header('sstream', items('istringstream ostringstream stringstream', 'class')),
  header('stdexcept', items('runtime_error logic_error invalid_argument out_of_range overflow_error', 'class')),
  header('cstddef', items('size_t ptrdiff_t byte', 'type')),
  header('cstdint', items('int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t', 'type')),
  header('concepts', items('integral floating_point same_as convertible_to derived_from', 'interface')),
  header('numbers', [], { numbers: items('pi e sqrt2 ln2', 'variable') }),
]
