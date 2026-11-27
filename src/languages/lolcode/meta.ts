import type { LanguageMeta } from '../types'

/** lolcode's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'lolcode',
  name: 'LOLCODE',
  category: 'Esoteric',
  aliases: ['lol'],
  extension: 'lol',
} satisfies LanguageMeta
