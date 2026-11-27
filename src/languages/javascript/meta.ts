import type { LanguageMeta } from '../types'

/** javascript's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'javascript',
  name: 'JavaScript',
  category: 'Web',
  aliases: ['js', 'node', 'ecmascript'],
  extension: 'js',
} satisfies LanguageMeta
