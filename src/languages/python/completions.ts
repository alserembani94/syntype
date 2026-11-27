import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('append extend pop', 'method'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** Matches `import x` and `from x import ...` for a module (or a dotted submodule of it). */
const imports = (module: string) => new RegExp(`^\\s*(?:import|from)\\s+${module.replace('.', '\\.')}\\b`, 'm')

/**
 * A standard-library module: `import json` then `json.` offers its members;
 * `from json import loads` makes `loads` a name of its own.
 */
const stdlib = (module: string, members: CompletionItem[]): VocabularyPack => ({
  name: module,
  detect: imports(module),
  globals: [{ label: module, kind: 'module' }, ...members],
  members: { [module]: members },
})

const builtins: VocabularyPack = {
  name: 'Python',
  globals: [
    ...items(
      'print len range enumerate zip map filter sorted reversed sum min max abs round isinstance issubclass hasattr getattr setattr open input iter next any all super repr hash format divmod callable vars',
      'function',
    ),
    ...items(
      'int float str bool list dict set tuple frozenset bytes object type Exception ValueError TypeError KeyError IndexError RuntimeError StopIteration AttributeError NotImplementedError ZeroDivisionError',
      'class',
    ),
    ...items('property staticmethod classmethod', 'function'),
  ],
  members: {
    // We can't know a value's type without a language service, so after any
    // other "." these common methods of built-in types are offered.
    '*': [
      ...items(
        'split rsplit join strip lstrip rstrip lower upper title replace startswith endswith find count format encode splitlines isdigit isalpha isalnum zfill',
        'method',
      ),
      ...items('append extend insert pop remove sort reverse index copy clear', 'method'),
      ...items('get items keys values update setdefault popitem', 'method'),
      ...items('add discard union intersection difference issubset', 'method'),
      ...items('read write readline readlines close', 'method'),
    ],
  },
}

const osMembers = [
  ...items('getcwd listdir makedirs remove rename walk getenv', 'function'),
  ...items('environ path sep', 'variable'),
]

export const packs: VocabularyPack[] = [
  builtins,
  stdlib('json', items('loads dumps load dump JSONDecodeError', 'function')),
  stdlib('re', [
    ...items('compile match search fullmatch sub subn findall finditer split escape', 'function'),
    ...items('IGNORECASE MULTILINE DOTALL VERBOSE', 'variable'),
  ]),
  stdlib('math', [
    ...items('sqrt floor ceil isclose log log2 log10 exp hypot gcd lcm prod fsum dist', 'function'),
    ...items('pi e inf nan tau', 'variable'),
  ]),
  // os also has os.path, which gets its own member list.
  {
    ...stdlib('os', osMembers),
    members: {
      os: osMembers,
      path: items('join exists isfile isdir dirname basename splitext abspath expanduser', 'function'),
    },
  },
  stdlib('collections', items('Counter defaultdict deque namedtuple OrderedDict ChainMap', 'class')),
  stdlib(
    'itertools',
    items('chain groupby islice product permutations combinations count cycle repeat accumulate pairwise', 'function'),
  ),
  stdlib('functools', items('lru_cache cache reduce partial wraps cached_property total_ordering', 'function')),
  stdlib('dataclasses', items('dataclass field asdict astuple replace', 'function')),
  stdlib(
    'typing',
    items('Any Optional Union Callable Iterable Iterator Sequence Mapping TypedDict Protocol Literal TypeVar Generic', 'class'),
  ),
  stdlib('datetime', items('datetime date time timedelta timezone', 'class')),
  stdlib('random', items('choice choices randint random shuffle sample uniform seed', 'function')),
  stdlib('time', items('time sleep perf_counter monotonic strftime', 'function')),
  stdlib('pathlib', items('Path PurePath', 'class')),
  stdlib('asyncio', items('run sleep gather create_task wait_for Queue Lock Event TimeoutError', 'function')),
  stdlib('contextlib', items('contextmanager suppress closing ExitStack asynccontextmanager', 'function')),
]
