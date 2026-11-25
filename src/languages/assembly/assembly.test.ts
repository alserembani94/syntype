/**
 * The assembly snippets are real x86-64 Linux programs: each one is assembled
 * with NASM, and programs are run and functions called from C to check what
 * they do. Skipped where NASM, ld or a C compiler isn't installed.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { assembly } from '.'
import { tokenize } from '../../lib/tokenize'

const has = (tool: string) => {
  try {
    execFileSync('sh', ['-c', `command -v ${tool}`], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
const toolsReady = process.platform === 'linux' && process.arch === 'x64' && ['nasm', 'ld', 'cc'].every(has)

/** Programs with a _start: what they print, given their input. */
const programs: Record<string, { input?: string; output: string }> = {
  'hello.asm': { output: 'Hello, world!\n' },
  'echo.asm': { input: 'meow\npurr\n', output: 'meow\npurr\n' },
  'print_number.asm': { output: '2026\n' },
  'countdown.asm': { output: '3\n2\n1\n' },
}

/** Instruction sequences without a label: run as the body of a program that must exit with status 0. */
const fragments = ['exit.asm']

/** Functions, called from C: the declaration and calls, and what the calls print. */
const functions: Record<string, { c: string; output: string }> = {
  'max.asm': { c: 'long max(long, long); P(max(3, 9)); P(max(9, 3)); P(max(-4, -7));', output: '9 9 -4 ' },
  'abs_value.asm': { c: 'long abs_value(long); P(abs_value(-5)); P(abs_value(7)); P(abs_value(0));', output: '5 7 0 ' },
  'swap.asm': { c: 'void swap(long *, long *); long a = 1, b = 2; swap(&a, &b); P(a); P(b);', output: '2 1 ' },
  'is_even.asm': { c: 'long is_even(long); P(is_even(4)); P(is_even(7)); P(is_even(0));', output: '1 0 1 ' },
  'sum_to.asm': { c: 'long sum_to(long); P(sum_to(1)); P(sum_to(10));', output: '1 55 ' },
  'str_length.asm': { c: 'long str_length(const char *); P(str_length("")); P(str_length("syntype"));', output: '0 7 ' },
  'factorial.asm': { c: 'long factorial(long); P(factorial(0)); P(factorial(5)); P(factorial(10));', output: '1 120 3628800 ' },
  'sum_array.asm': {
    c: 'long sum_array(const long *, long); long v[] = {4, -1, 10}; P(sum_array(v, 3)); P(sum_array(v, 0));',
    output: '13 0 ',
  },
  'gcd.asm': { c: 'long gcd(long, long); P(gcd(48, 18)); P(gcd(7, 0)); P(gcd(17, 5));', output: '6 7 1 ' },
  'fibonacci.asm': {
    c: 'long fibonacci(long); for (int i = 0; i < 8; i++) P(fibonacci(i)); P(fibonacci(50));',
    output: '0 1 1 2 3 5 8 13 12586269025 ',
  },
  'to_upper.asm': {
    c: 'void to_upper(char *); char s[] = "Hello, asm 42!"; to_upper(s); printf("%s", s);',
    output: 'HELLO, ASM 42!',
  },
  'reverse.asm': {
    c: 'void reverse(char *, long); char s[] = "stressed", e[] = ""; reverse(s, 8); reverse(e, 0); printf("%s", s);',
    output: 'desserts',
  },
  'bubble_sort.asm': {
    c: 'void bubble_sort(long *, long); long v[] = {5, -2, 9, 0, 3}; bubble_sort(v, 5); for (int i = 0; i < 5; i++) P(v[i]);',
    output: '-2 0 3 5 9 ',
  },
}

describe.skipIf(!toolsReady)('assembly snippets are real, working x86-64 code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'syntype-asm-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  const run = (file: string, args: string[], input?: string) =>
    execFileSync(file, args, { cwd: dir, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  const assemble = (name: string, code: string) => {
    const base = name.replace(/\.asm$/, '')
    writeFileSync(join(dir, name), code + '\n')
    // NASM's warnings (an unused label, an ambiguous size) are failures here.
    run('nasm', ['-f', 'elf64', '-w+error', '-o', `${base}.o`, name])
    return base
  }

  it('every snippet is listed as a program, a fragment or a function', () => {
    const listed = [...Object.keys(programs), ...fragments, ...Object.keys(functions)]
    expect(assembly.snippets.map((s) => s.name).sort()).toEqual(listed.sort())
  })

  it.each(assembly.snippets.map((s) => [s.name, s] as const))('%s assembles and does what it should', (name, s) => {
    if (name in programs) {
      const base = assemble(name, s.code)
      run('ld', ['-o', base, `${base}.o`])
      expect(run(`./${base}`, [], programs[name].input)).toBe(programs[name].output)
    } else if (fragments.includes(name)) {
      const base = assemble(name, `global _start\n_start:\n${s.code}`)
      run('ld', ['-o', base, `${base}.o`])
      expect(() => run(`./${base}`, [])).not.toThrow()
    } else {
      const base = assemble(name, s.code)
      const { c, output } = functions[name]
      writeFileSync(join(dir, `${base}_main.c`), `#include <stdio.h>\n#define P(x) printf("%ld ", (long)(x))\nint main(void) { ${c} return 0; }\n`)
      run('cc', ['-no-pie', '-o', `${base}_test`, `${base}_main.c`, `${base}.o`])
      expect(run(`./${base}_test`, [])).toBe(output)
    }
  })
})

describe('assembly highlighting', () => {
  const classOf = (code: string, word: string) => tokenize(code, assembly.highlight)[code.indexOf(word)]

  it('colours labels, instructions, registers, numbers and comments', () => {
    const code = '_start:\n.loop:\n    MOV rax, 0x3c ; exit\n    jnz .loop'
    expect(classOf(code, '_start')).toBe('fn')
    expect(classOf(code, '.loop:')).toBe('fn')
    expect(classOf(code, 'MOV')).toBe('kw')
    expect(classOf(code, 'rax')).toBe('ty')
    expect(classOf(code, '0x3c')).toBe('num')
    expect(classOf(code, '; exit')).toBe('com')
  })

  it('does not take a colon in a string or comment for a label', () => {
    const code = '    msg db "Sum: ", 0 ; note: here'
    expect(classOf(code, 'Sum')).toBe('str')
    expect(classOf(code, 'note')).toBe('com')
  })
})
