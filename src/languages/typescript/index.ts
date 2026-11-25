import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { javascript } from '../javascript'
import { getTypeScriptService } from '../../lib/ts/client'
import raw from './snippets.txt?raw'

const TS_KEYWORDS =
  'interface type enum implements private protected public readonly abstract declare namespace keyof infer satisfies is asserts override unknown never any string number boolean symbol bigint object'.split(
    ' ',
  )

export const typescript: Language = {
  id: 'typescript',
  name: 'TypeScript',
  extension: 'ts',
  highlight: {
    ...javascript.highlight,
    keywords: [...javascript.highlight.keywords, ...TS_KEYWORDS],
  },
  // VS Code's TypeScript language configuration matches JavaScript's.
  autoClosingPairs: javascript.autoClosingPairs,
  completion: {
    wordChar: /[\w$]/,
    service: getTypeScriptService,
    serviceMode: 'typescript',
    // VS Code's TypeScript trigger characters, minus "/", "@", "<" and " "
    // (import paths, decorators, JSX), which no snippet needs yet.
    triggerCharacters: ['.', '"', "'", '`', '#'],
  },
  snippets: parseSnippets(raw),
}
