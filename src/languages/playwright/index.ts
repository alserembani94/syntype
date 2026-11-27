import type { Language } from '../types'
import { meta } from './meta'
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
  ...meta,
  snippets: parseSnippets(raw),
}
