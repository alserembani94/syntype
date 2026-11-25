import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { typescript } from '../typescript'
import raw from './snippets.txt?raw'

/**
 * Playwright tests in TypeScript: everything from the TypeScript language,
 * including its language service, which knows @playwright/test through a
 * type stub (src/lib/ts/stubs.ts).
 */
export const playwright: Language = {
  ...typescript,
  id: 'playwright',
  name: 'Playwright',
  category: 'Testing & QA',
  aliases: ['e2e', 'end-to-end'],
  basedOn: 'TypeScript',
  snippets: parseSnippets(raw),
}
