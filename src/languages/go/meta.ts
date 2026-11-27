import type { LanguageMeta } from '../types'

/** go's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'go',
  name: 'Go',
  category: 'Systems',
  aliases: ['golang'],
  extension: 'go',
} satisfies LanguageMeta
