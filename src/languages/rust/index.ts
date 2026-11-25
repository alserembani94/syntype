import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

export const rust: Language = {
  id: 'rust',
  name: 'Rust',
  extension: 'rs',
  // rustfmt's default.
  indentSize: 4,
  highlight: {
    keywords:
      'as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while'.split(
        ' ',
      ),
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    // Only double quotes: ' starts both char literals and lifetimes ('a).
    strings: ['"'],
  },
  // From VS Code's Rust language configuration (extensions/rust/language-configuration.json):
  // brackets and double quotes only; no ' pair, because of lifetimes.
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
  ],
  // No in-browser language service for Rust: keywords, typed words and
  // vocabulary packs (the prelude, plus std modules a snippet uses).
  completion: {
    wordChar: /\w/,
    memberTriggers: ['.', '::'],
    packs,
  },
  snippets: parseSnippets(raw),
}
