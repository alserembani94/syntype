import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { javascript } from '../javascript'
import { builtins } from '../javascript/completions'
import { createTypeScriptService } from '../../lib/ts/client'
import raw from './snippets.txt?raw'

const TS_KEYWORDS =
  'interface type enum implements private protected public readonly abstract declare namespace keyof infer satisfies is asserts override unknown never any string number boolean symbol bigint object'.split(
    ' ',
  )

/** One TypeScript worker for the whole page, started the first time it's needed. */
let service: ReturnType<typeof createTypeScriptService> | null = null

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
    memberTriggers: ['.'],
    // Used until the TypeScript service is ready, or if it can't start.
    packs: [builtins],
    memberCommitCharacters: ['.', ',', ';', '('],
    service: () => (service ??= createTypeScriptService()),
    // VS Code's TypeScript trigger characters, minus "/", "@", "<" and " "
    // (import paths, decorators, JSX), which no snippet needs yet.
    triggerCharacters: ['.', '"', "'", '`', '#'],
  },
  snippets: parseSnippets(raw),
}
