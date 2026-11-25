import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

export const yaml: Language = {
  id: 'yaml',
  name: 'YAML',
  extension: 'yaml',
  indentSize: 2,
  highlight: {
    keywords: ['true', 'false', 'null'],
    lineComments: ['#'],
    strings: ['"', "'"],
    // A mapping key: at the start of a line or after "- ", followed by ":".
    keyPattern: /^[ \t]*(?:- )?([\w.$-]+)(?=:(?:\s|$))/gm,
  },
  // From VS Code's YAML language configuration (extensions/yaml/language-configuration.json):
  // brackets and both quotes, with no notIn exceptions.
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: "'", close: "'" },
  ],
  // VS Code's YAML support offers words from the file; the format packs add keys
  // for files it recognises (GitHub Actions, Compose, Kubernetes and more).
  // YAML has no member access, so nothing opens member lists.
  completion: {
    wordChar: /\w/,
    memberTriggers: [],
    packs,
  },
  snippets: parseSnippets(raw),
}
