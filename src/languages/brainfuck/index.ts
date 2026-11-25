import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import raw from './snippets.txt?raw'

export const brainfuck: Language = {
  id: 'brainfuck',
  name: 'Brainfuck',
  category: 'Esoteric',
  aliases: ['bf'],
  extension: 'bf',
  // Eight one-character commands and no words: see "symbolic" in CLAUDE.md.
  symbolic: true,
  indentSize: 2,
  highlight: {
    keywords: [],
    // Any character that isn't a command is a comment.
    commands: {
      '+': 'num',
      '-': 'num',
      '<': 'fn',
      '>': 'fn',
      '[': 'kw',
      ']': 'kw',
      '.': 'str',
      ',': 'str',
    },
  },
  // VS Code has no built-in Brainfuck support; this is from the brainfuck-syntax
  // extension (attilabuti.brainfuck-syntax): only [ closes.
  autoClosingPairs: [{ open: '[', close: ']' }],
  // No words to complete: no packs, nothing opens member lists.
  completion: { wordChar: /\w/, memberTriggers: [] },
  snippets: parseSnippets(raw),
}
