import type { LanguageMeta } from '../types'

/** php's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'php',
  name: 'PHP',
  category: 'Web',
  extension: 'php',
} satisfies LanguageMeta
