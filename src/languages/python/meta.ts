import type { LanguageMeta } from '../types'

/** python's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'python',
  name: 'Python',
  category: 'Scripting',
  aliases: ['py'],
  extension: 'py',
} satisfies LanguageMeta
