import type { CompletionItem, SuggestionKind, VocabularyPack } from '../types'

/** Shorthand: items('log error warn', 'method'). */
const items = (labels: string, kind: SuggestionKind): CompletionItem[] =>
  labels.split(/\s+/).filter(Boolean).map((label) => ({ label, kind }))

/** Members of common built-in instances. Used after a "." when we can't know the type. */
const instanceMembers: CompletionItem[] = [
  // Array
  ...items(
    'map filter reduce reduceRight forEach find findIndex findLast some every includes indexOf lastIndexOf push pop shift unshift slice splice concat join sort reverse flat flatMap at fill keys values entries toSorted toReversed with',
    'method',
  ),
  ...items('length', 'property'),
  // String / Number
  ...items(
    'split trim trimStart trimEnd toLowerCase toUpperCase replace replaceAll startsWith endsWith padStart padEnd charAt charCodeAt repeat substring match matchAll localeCompare normalize toFixed toString toLocaleString valueOf',
    'method',
  ),
  // Promise
  ...items('then catch finally', 'method'),
  // Map / Set
  ...items('get set has delete clear add', 'method'),
  ...items('size', 'property'),
  // Function
  ...items('call apply bind', 'method'),
  // fetch Response
  ...items('json text blob arrayBuffer clone', 'method'),
  ...items('ok status statusText headers body', 'property'),
]

export const builtins: VocabularyPack = {
  name: 'JavaScript',
  globals: [
    ...items('console Math JSON Intl Reflect globalThis', 'variable'),
    ...items(
      'Object Array Promise Date Number String Boolean Symbol BigInt Map Set WeakMap WeakSet Error TypeError RangeError RegExp URL URLSearchParams AbortController Response Request Headers',
      'class',
    ),
    ...items(
      'setTimeout clearTimeout setInterval clearInterval queueMicrotask fetch structuredClone parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent',
      'function',
    ),
  ],
  members: {
    console: items('log error warn info debug table time timeEnd group groupEnd assert count dir trace', 'method'),
    Math: [
      ...items(
        'abs ceil floor round trunc sign max min pow sqrt cbrt hypot random exp log log2 log10 sin cos tan atan2',
        'method',
      ),
      ...items('PI E', 'property'),
    ],
    Object: items(
      'keys values entries fromEntries assign freeze isFrozen create defineProperty getPrototypeOf hasOwn is groupBy',
      'method',
    ),
    Array: items('isArray from of', 'method'),
    Promise: items('all allSettled any race resolve reject withResolvers', 'method'),
    JSON: items('parse stringify', 'method'),
    Date: items('now parse UTC', 'method'),
    Number: [
      ...items('isInteger isFinite isNaN isSafeInteger parseFloat parseInt', 'method'),
      ...items('MAX_SAFE_INTEGER MIN_SAFE_INTEGER EPSILON', 'property'),
    ],
    String: items('fromCharCode fromCodePoint raw', 'method'),
    '*': instanceMembers,
  },
}

const hooks = 'useState useEffect useLayoutEffect useCallback useMemo useRef useReducer useContext useId useTransition useDeferredValue'

export const react: VocabularyPack = {
  name: 'react',
  detect: /from\s+["']react["']|require\(\s*["']react["']\s*\)/,
  globals: [
    ...items(hooks, 'function'),
    ...items('createContext memo forwardRef lazy startTransition', 'function'),
    ...items('Fragment Suspense StrictMode', 'class'),
    ...items('React', 'module'),
  ],
  members: {
    React: [...items(hooks, 'function'), ...items('createContext memo forwardRef lazy', 'function')],
  },
}

export const express: VocabularyPack = {
  name: 'express',
  detect: /from\s+["']express["']|require\(\s*["']express["']\s*\)/,
  // app, req and res are conventional names, not exports: they're suggested once typed, and get members below.
  globals: items('express', 'function'),
  members: {
    express: items('json urlencoded static Router', 'method'),
    app: items('get post put patch delete use listen route all set', 'method'),
    router: items('get post put patch delete use route all', 'method'),
    req: items('params query body headers method path cookies ip get', 'property'),
    res: items('status json send sendStatus set redirect end render cookie type', 'method'),
  },
}
