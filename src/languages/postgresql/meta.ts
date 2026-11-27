import type { LanguageMeta } from '../types'

/** postgresql's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'postgresql',
  name: 'PostgreSQL',
  category: 'Data & config',
  aliases: ['postgres', 'psql', 'sql'],
  extension: 'sql',
} satisfies LanguageMeta
