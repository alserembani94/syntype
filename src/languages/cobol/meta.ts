import type { LanguageMeta } from '../types'

/** cobol's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'cobol',
  name: 'COBOL',
  category: 'Mainframe',
  aliases: ['cbl'],
  extension: 'cbl',
} satisfies LanguageMeta
