import type { Language } from '../types'
import { meta } from './meta'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

export const c: Language = {
  ...meta,
  // VS Code's default, and K&R style as most C outside the Linux kernel is written.
  indentSize: 4,
  highlight: {
    keywords: [
      ...'auto break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while'.split(' '),
      ...'_Alignas _Alignof _Atomic _Generic _Noreturn _Static_assert _Thread_local'.split(' '),
      // stdbool.h and stddef.h, written as if they were keywords (C23 makes true and false so).
      ...'true false NULL'.split(' '),
      // Preprocessor directives: the identifier pattern below lets a name start with #.
      ...'#include #define #undef #if #ifdef #ifndef #elif #else #endif #error #pragma'.split(' '),
    ],
    types: [
      ...'void char short int long float double signed unsigned _Bool _Complex'.split(' '),
      ...'bool size_t ptrdiff_t ssize_t intptr_t uintptr_t FILE'.split(' '),
      ...'int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t'.split(' '),
    ],
    identifier: '#?[A-Za-z_]\\w*',
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    // " strings, ' character constants. A header name in <stdio.h> stays plain:
    // treating < as a quote would swallow every comparison.
    strings: ['"', "'"],
  },
  // From VS Code's C and C++ language configuration (extensions/cpp/language-configuration.json).
  // Its "/*" → "*/" and "/**" → " */" comment pairs are left out, as PHP's are: openers here
  // are brackets and quotes, and a comment closer isn't in the snippet's text to type over.
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string'] },
  ],
  // VS Code's C suggestions come from extensions (C/C++, clangd) that run a compiler front end,
  // so none runs in the browser: keywords, typed words and a pack per included header.
  completion: {
    wordChar: /\w/,
    memberTriggers: ['.', '->'],
    packs,
  },
  snippets: parseSnippets(raw),
}
