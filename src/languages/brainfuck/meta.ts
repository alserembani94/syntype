import type { LanguageMeta } from '../types'

/** brainfuck's identity: what the first load knows about it (src/languages/catalog.ts). */
export const meta = {
  id: 'brainfuck',
  name: 'Brainfuck',
  category: 'Esoteric',
  aliases: ['bf'],
  extension: 'bf',
  // Eight one-character commands and no words: see "symbolic" in CLAUDE.md.
  symbolic: true,
} satisfies LanguageMeta
