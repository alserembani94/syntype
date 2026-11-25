import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

const KEYWORDS =
  'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enum extends final finally fn for foreach function global goto if implements include include_once instanceof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield true false null self parent'
// Type names, highlighted like keywords as VS Code's PHP grammar does.
const TYPES = 'int float string bool void mixed never iterable object'

export const php: Language = {
  id: 'php',
  name: 'PHP',
  category: 'Web',
  extension: 'php',
  // PSR-12.
  indentSize: 4,
  highlight: {
    keywords: `${KEYWORDS} ${TYPES}`.split(' '),
    lineComments: ['//', '#'],
    blockComments: [['/*', '*/']],
    strings: ["'", '"'],
  },
  // From VS Code's PHP language configuration (extensions/php/language-configuration.json).
  // Unlike most languages, PHP's brackets don't auto-close inside strings either.
  // Its "/**" → " */" doc-comment pair is left out: openers here are brackets and quotes.
  autoClosingPairs: [
    { open: '{', close: '}', notIn: ['string'] },
    { open: '[', close: ']', notIn: ['string'] },
    { open: '(', close: ')', notIn: ['string'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
  ],
  // No in-browser language service for PHP: keywords, typed words and
  // vocabulary for built-in functions, classes and constants.
  completion: {
    // VS Code's PHP word pattern keeps $ inside words, so $user is one word.
    wordChar: /[\w$]/,
    memberTriggers: ['->', '::'],
    packs,
  },
  snippets: parseSnippets(raw),
}
