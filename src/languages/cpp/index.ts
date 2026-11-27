import type { Language } from '../types'
import { meta } from './meta'
import { parseSnippets } from '../snippets'
import { packs } from './completions'
import raw from './snippets.txt?raw'

export const cpp: Language = {
  ...meta,
  // VS Code's default, as for C.
  indentSize: 4,
  highlight: {
    keywords: [
      ...'alignas alignof asm auto break case catch class concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do dynamic_cast else enum explicit export extern final for friend goto if inline mutable namespace new noexcept operator override private protected public register reinterpret_cast requires return sizeof static static_assert static_cast struct switch template this thread_local throw try typedef typeid typename union using virtual volatile while'.split(' '),
      ...'true false nullptr'.split(' '),
      // Preprocessor directives: the identifier pattern below lets a name start with #.
      ...'#include #define #undef #if #ifdef #ifndef #elif #else #endif #error #pragma'.split(' '),
    ],
    types: [
      ...'void bool char wchar_t char8_t char16_t char32_t short int long float double signed unsigned'.split(' '),
      ...'size_t ptrdiff_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t'.split(' '),
      // The standard library's most used types, coloured as VS Code colours them after std::.
      ...'string string_view vector array list deque map set unordered_map unordered_set pair tuple optional variant span unique_ptr shared_ptr weak_ptr function ifstream ofstream istringstream ostringstream'.split(' '),
    ],
    identifier: '#?[A-Za-z_]\\w*',
    lineComments: ['//'],
    blockComments: [['/*', '*/']],
    // " strings, ' character literals. Template and #include angle brackets stay plain.
    strings: ['"', "'"],
  },
  // From VS Code's C and C++ language configuration (extensions/cpp/language-configuration.json),
  // as for C: its comment pairs are left out, and like VS Code, "<" isn't auto-closed.
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: "'", close: "'", notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string'] },
  ],
  // As for C, no service runs in the browser: keywords, typed words, and a pack per included
  // header that adds its names after std::.
  completion: {
    wordChar: /\w/,
    memberTriggers: ['.', '->', '::'],
    packs,
  },
  snippets: parseSnippets(raw),
}
