import type { LanguageMeta } from '../types'

/** pytest's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'pytest',
  name: 'pytest',
  category: 'Testing & QA',
  aliases: ['unit test'],
  basedOn: 'Python',
  extension: 'py',
} satisfies LanguageMeta
