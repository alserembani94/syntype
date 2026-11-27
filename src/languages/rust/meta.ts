import type { LanguageMeta } from '../types'

/** rust's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'rust',
  name: 'Rust',
  category: 'Systems',
  aliases: ['rs'],
  extension: 'rs',
} satisfies LanguageMeta
