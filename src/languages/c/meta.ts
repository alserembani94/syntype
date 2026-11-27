import type { LanguageMeta } from '../types'

/** c's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'c',
  name: 'C',
  category: 'Systems',
  aliases: ['c11', 'c17', 'ansi c'],
  extension: 'c',
} satisfies LanguageMeta
