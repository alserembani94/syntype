import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import raw from './snippets.txt?raw'
import { getTypeScriptService } from '../../lib/ts/client'

export const javascript: Language = {
  id: 'javascript',
  name: 'JavaScript',
  extension: 'js',
  highlight: {
    keywords:
      'const let var function return if else for while do switch case default break continue new class extends super this import export from as async await try catch finally throw typeof instanceof in of null undefined true false void delete yield get set static'.split(
        ' ',
      ),
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    strings: ['"', "'"],
    multilineStrings: ['`'],
  },
  // From VS Code's JavaScript language configuration.
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string'] },
    { open: '`', close: '`', notIn: ['string', 'comment'] },
  ],
  completion: {
    wordChar: /[\w$]/,
    // VS Code runs JavaScript through TypeScript's service too. Until it's
    // ready (about a second), suggestions are keywords and words already typed.
    service: getTypeScriptService,
    serviceMode: 'javascript',
    triggerCharacters: ['.', '"', "'", '`', '#'],
  },
  snippets: parseSnippets(raw),
}
