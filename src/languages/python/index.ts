import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

export const python: Language = {
  id: 'python',
  name: 'Python',
  extension: 'py',
  // PEP 8.
  indentSize: 4,
  highlight: {
    keywords:
      'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(
        ' ',
      ),
    lineComments: ['#'],
    strings: ['"', "'"],
    multilineStrings: ['"""', "'''"],
  },
  // From VS Code's Python language configuration (extensions/python/language-configuration.json).
  // The prefixed pairs (f", r', ...) let a quote auto-close right after its string prefix.
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    ...['r', 'R', 'u', 'U', 'f', 'F', 'b', 'B'].flatMap((p) => [
      { open: `${p}"`, close: '"', notIn: ['string', 'comment'] as ('string' | 'comment')[] },
      { open: `${p}'`, close: "'", notIn: ['string', 'comment'] as ('string' | 'comment')[] },
    ]),
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '`', close: '`', notIn: ['string'] },
  ],
  // No in-browser language service for Python yet: keywords, typed words and
  // these vocabulary packs (built-ins, plus standard-library modules a snippet imports).
  completion: {
    wordChar: /\w/,
    packs,
  },
  snippets: parseSnippets(raw),
}
