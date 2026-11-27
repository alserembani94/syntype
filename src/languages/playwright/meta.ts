import type { LanguageMeta } from '../types'

/** playwright's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'playwright',
  name: 'Playwright',
  category: 'Testing & QA',
  aliases: ['e2e', 'end-to-end'],
  basedOn: 'TypeScript',
  extension: 'ts',
} satisfies LanguageMeta
