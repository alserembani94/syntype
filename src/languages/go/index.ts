import type { Language } from '../types'
import { meta } from './meta'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

export const go: Language = {
  ...meta,
  // gofmt indents with tabs; they display 4 columns wide.
  indentWithTabs: true,
  indentSize: 4,
  highlight: {
    keywords:
      'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var true false nil iota'.split(
        ' ',
      ),
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    // ' is a rune literal; ` is a raw string that may span lines.
    strings: ['"', "'"],
    multilineStrings: ['`'],
  },
  // From VS Code's Go language configuration (extensions/go/language-configuration.json).
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '`', close: '`', notIn: ['string'] },
    { open: '"', close: '"', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
  ],
  // No in-browser language service for Go: keywords, typed words and
  // vocabulary packs (built-ins, plus standard-library packages a snippet imports).
  completion: {
    wordChar: /\w/,
    packs,
  },
  snippets: parseSnippets(raw),
}
