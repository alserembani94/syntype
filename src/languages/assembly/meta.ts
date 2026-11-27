import type { LanguageMeta } from '../types'

/** assembly's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'assembly',
  name: 'x86-64 Assembly',
  category: 'Systems',
  aliases: ['asm', 'nasm', 'x86', 'x64', 'amd64', 'assembler'],
  extension: 'asm',
} satisfies LanguageMeta
