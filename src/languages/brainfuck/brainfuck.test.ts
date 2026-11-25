import { describe, expect, it } from 'vitest'
import { brainfuck } from '.'
import { runBrainfuck } from '../../test/brainfuck'

/** What each snippet prints, given its input. Every snippet must be listed. */
const expected: Record<string, { input?: string; output: string }> = {
  'cat.bf': { input: 'meow', output: 'meow' },
  'move.bf': { output: '' },
  'copy.bf': { output: '' },
  'reverse.bf': { input: 'stressed', output: 'desserts' },
  'hello.bf': { output: 'Hello World!\n' },
  'digits.bf': { output: '0123456789\n' },
  'alphabet.bf': { output: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\n' },
  'countdown.bf': { output: '9876543210\n' },
  'add_digits.bf': { input: '34', output: '7' },
  'hello_commented.bf': { output: 'Hello World!\n' },
  'triangle.bf': { output: '*\n**\n***\n****\n*****\n' },
  'uppercase.bf': { input: 'syntype\n', output: 'SYNTYPE\n' },
  'count_chars.bf': { input: 'cobol\n', output: '5\n' },
}

describe('Brainfuck snippets are real, working programs', () => {
  it('every snippet has an expected output', () => {
    expect(brainfuck.snippets.map((s) => s.name).sort()).toEqual(Object.keys(expected).sort())
  })

  it.each(brainfuck.snippets.map((s) => [s.name, s] as const))('%s prints what it should', (name, s) => {
    const { input, output } = expected[name]
    expect(runBrainfuck(s.code, input)).toBe(output)
  })

  it('comments never contain command characters, which would change the program', () => {
    for (const s of brainfuck.snippets)
      for (const line of s.code.split('\n'))
        if (/[a-z]/i.test(line)) expect(line, s.name).not.toMatch(/[-+<>[\].,]/)
  })
})
