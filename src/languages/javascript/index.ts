import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import raw from './snippets.txt?raw'

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
  snippets: parseSnippets(raw),
}
