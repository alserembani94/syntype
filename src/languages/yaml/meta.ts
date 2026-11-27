import type { LanguageMeta } from '../types'

/** yaml's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'yaml',
  name: 'YAML',
  category: 'Data & config',
  aliases: ['yml'],
  extension: 'yaml',
} satisfies LanguageMeta
