import type { Language } from '../types'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

export const csharp: Language = {
  id: 'csharp',
  name: 'C#',
  category: 'Applications',
  aliases: ['c#', 'cs', 'dotnet', '.net'],
  extension: 'cs',
  // The .NET convention (and dotnet format's default); braces on their own line (Allman).
  indentSize: 4,
  highlight: {
    keywords: [
      ...'abstract as base break case catch checked class const continue default delegate do else enum event explicit extern false finally fixed for foreach goto if implicit in interface internal is lock namespace new null operator out override params private protected public readonly ref return sealed sizeof stackalloc static struct switch this throw true try typeof unchecked unsafe using virtual volatile while'.split(' '),
      // Contextual keywords VS Code colours as keywords. Left out: value, file, and, or, not
      // and global, which are just as often ordinary names.
      ...'var async await record init required get set when where yield nameof partial with'.split(' '),
    ],
    types: 'bool byte sbyte char decimal double float int uint long ulong short ushort nint nuint object string void dynamic'.split(' '),
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    // " strings (with $ and @ prefixes, which stay outside the quote) and ' characters.
    strings: ['"', "'"],
  },
  // From VS Code's C# language configuration (extensions/csharp/language-configuration.json).
  // Its { pair has no "notIn", so as in VS Code, { also auto-closes inside $"..." strings.
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
  ],
  // VS Code's C# suggestions come from the C# extension's Roslyn server, a .NET process that
  // can't run in the browser: keywords, typed words and the packs in completions.ts.
  completion: {
    wordChar: /\w/,
    memberTriggers: ['.'],
    packs,
  },
  snippets: parseSnippets(raw),
}
