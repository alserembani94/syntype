/** A small Brainfuck interpreter for tests: 30,000 wrapping byte cells, input from a string. */
export function runBrainfuck(code: string, input = '', maxSteps = 10_000_000): string {
  const prog = [...code].filter((c) => '+-<>[].,'.includes(c))
  const jump = new Map<number, number>()
  const stack: number[] = []
  prog.forEach((c, i) => {
    if (c === '[') stack.push(i)
    else if (c === ']') {
      const j = stack.pop()
      if (j === undefined) throw new Error('unbalanced ]')
      jump.set(i, j)
      jump.set(j, i)
    }
  })
  if (stack.length) throw new Error('unbalanced [')
  const mem = new Uint8Array(30_000)
  let p = 0
  let at = 0
  let out = ''
  for (let ip = 0, steps = 0; ip < prog.length; ip++) {
    if (++steps > maxSteps) throw new Error('did not finish')
    const c = prog[ip]
    if (c === '+') mem[p]++
    else if (c === '-') mem[p]--
    else if (c === '>') p++
    else if (c === '<') p--
    else if (c === '.') out += String.fromCharCode(mem[p])
    else if (c === ',') mem[p] = at < input.length ? input.charCodeAt(at++) : 0
    else if (c === '[' && !mem[p]) ip = jump.get(ip)!
    else if (c === ']' && mem[p]) ip = jump.get(ip)!
    if (p < 0 || p >= mem.length) throw new Error('pointer left the tape')
  }
  return out
}
