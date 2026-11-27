import type { Language } from '../types'
import { meta } from './meta'
import { parseSnippets } from '../snippets'
import { packs, REGISTERS } from './completions'
import raw from './snippets.txt?raw'

/** Instructions, then directives and size specifiers. */
const KEYWORDS =
  'mov movzx movsx movsxd lea add sub inc dec neg imul mul idiv div cqo cdq and or xor not shl shr sar rol ror cmp test jmp je jne jz jnz jl jle jg jge ja jae jb jbe js jns call ret push pop syscall xchg cmove cmovne cmovl cmovle cmovg cmovge cmova cmovb sete setne setl setle setg setge nop leave ' +
  'section segment global extern bits default rel db dw dd dq resb resw resd resq equ times byte word dword qword'

export const assembly: Language = {
  ...meta,
  // NASM style: labels at column 0, instructions and data one level in.
  indentSize: 4,
  highlight: {
    keywords: KEYWORDS.split(' '),
    // NASM doesn't care about the case of instructions or registers (MOV, Rax).
    caseInsensitive: true,
    types: REGISTERS,
    capitalizedTypes: false,
    // Local labels start with a dot (.loop), as do section names (.text).
    identifier: '[A-Za-z_.][\\w.]*',
    lineComments: [';'],
    // Backquoted strings are NASM's, with C escapes (`Hi\n`).
    strings: ['"', "'", '`'],
    // A label: a name at the start of a line, followed by ":".
    keyPattern: /^[ \t]*([A-Za-z_.][\w.]*)(?=:)/gm,
  },
  // VS Code has no built-in assembly support; these come from the most used
  // x86-64 assembly extension (13xforever.language-x86-64-assembly,
  // language-configuration.json in 13xforever/x86_64-assembly-vscode).
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
  // No language service: instructions and directives, registers, and labels
  // and data names typed earlier. Assembly has no member access.
  completion: {
    // Local labels like .loop are one word, dot included.
    wordChar: /[\w.]/,
    memberTriggers: [],
    packs,
  },
  snippets: parseSnippets(raw),
}
