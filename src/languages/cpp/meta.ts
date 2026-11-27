import type { LanguageMeta } from '../types'

/** cpp's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'cpp',
  name: 'C++',
  category: 'Systems',
  aliases: ['c++', 'cxx', 'cplusplus', 'c++20'],
  extension: 'cpp',
} satisfies LanguageMeta
