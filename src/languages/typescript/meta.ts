import type { LanguageMeta } from '../types'

/** typescript's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'typescript',
  name: 'TypeScript',
  category: 'Web',
  aliases: ['ts'],
  extension: 'ts',
} satisfies LanguageMeta
