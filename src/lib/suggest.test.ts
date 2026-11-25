import { describe, expect, it } from 'vitest'
import { acceptCompletion, counts, createRun, typeChar, type Run } from './engine'
import { buildSuggestConfig, fuzzyMatch, getSuggestions, suggestContext, wordStart, type Suggestion } from './suggest'
import { summarize } from './stats'
import { getLanguage, type Language } from '../languages'

const js = getLanguage('javascript')
const typeAll = (run: Run, text: string) => [...text].reduce(typeChar, run)
const setup = (code: string) => ({
  run: createRun(code, { autoIndent: true, autoClose: false }),
  cfg: buildSuggestConfig(code, js, false),
})
type Cfg = ReturnType<typeof setup>['cfg']
const list = (run: Run, cfg: Cfg): Suggestion[] => {
  const ctx = suggestContext(run, cfg)
  return ctx ? getSuggestions(run, ctx, cfg) : []
}
const labels = (run: Run, cfg: Cfg) => list(run, cfg).map((s) => s.label)

describe('fuzzyMatch', () => {
  it('matches prefixes and camelCase humps, like VS Code', () => {
    expect(fuzzyMatch('use', 'useCallback')?.matches).toEqual([0, 1, 2])
    expect(fuzzyMatch('uC', 'useCallback')?.matches).toEqual([0, 3])
    expect(fuzzyMatch('ucb', 'useCallback')).not.toBeNull()
  })

  it('requires the first letter at a word start or hump', () => {
    expect(fuzzyMatch('ec', 'useCallback')).toBeNull()
    expect(fuzzyMatch('st', 'useState')).not.toBeNull()
  })

  it('ranks a straight prefix above a scattered match', () => {
    const a = fuzzyMatch('con', 'const')!.score
    const b = fuzzyMatch('con', 'clearTimeoutNow')?.score ?? -1
    expect(a).toBeGreaterThan(b)
  })
})

describe('suggestions', () => {
  it('offers keywords as soon as a word starts', () => {
    const { run, cfg } = setup('const a = 1; return a;')
    expect(labels(typeAll(run, 'co'), cfg)).toContain('const')
    expect(labels(typeAll(run, 'retu'), cfg)[0]).toBe('return')
  })

  it('offers words typed earlier in the snippet, but not ones not typed yet', () => {
    const code = 'const total = 1;\nlet totally = total + values;'
    const { run, cfg } = setup(code)
    const r = typeAll(run, 'const total = 1;\nlet to')
    expect(labels(r, cfg)).toContain('total')
    expect(labels(r, cfg)).not.toContain('values')
  })

  it("leaves out the word being typed and numbers, as VS Code's word-based list does", () => {
    const { run, cfg } = setup('let x = 100;\nlet abc = abc;')
    const r = typeAll(run, 'let x = 100;\nlet abc')
    expect(labels(r, cfg)).not.toContain('abc')
    expect(labels(r, cfg)).not.toContain('100')
  })

  it('keeps a keyword even when it is fully typed, so Enter accepts it like VS Code', () => {
    const { run, cfg } = setup('return x;')
    expect(labels(typeAll(run, 'return'), cfg)).toContain('return')
  })

  it('stays quiet inside strings and comments', () => {
    const { run, cfg } = setup('const s = "hello"; // note')
    let r = typeAll(run, 'const s = "he')
    expect(suggestContext(r, cfg)).toBeNull()
    r = typeAll(r, 'llo"; // no')
    expect(suggestContext(r, cfg)).toBeNull()
  })

  it('has no word to complete right after a symbol', () => {
    const { run, cfg } = setup('f(x);')
    expect(wordStart(typeAll(run, 'f('), cfg)).toBe(-1)
  })
})

describe('accepting a suggestion', () => {
  it('replaces the typed prefix, counts one keystroke, and marks the rest as suggested', () => {
    const { run } = setup('const value = 1;')
    let r = typeAll(run, 'co')
    r = acceptCompletion(r, 0, 'const')
    expect(r.pos).toBe(5)
    expect(r.keystrokes).toBe(3)
    expect(r.completed.slice(0, 5)).toEqual([false, false, true, true, true])
    expect(counts(r)).toMatchObject({ correct: 2, suggested: 3, incorrect: 0 })
  })

  it('checks a wrong suggestion letter by letter, like typing', () => {
    const { run } = setup('useCallback(f);')
    let r = typeAll(run, 'use')
    r = acceptCompletion(r, 0, 'useState')
    expect(counts(r).incorrect).toBeGreaterThan(0)
    expect(r.correctKeystrokes).toBe(3)
  })

  it('never runs past the end of the line', () => {
    const { run } = setup('let a\nb')
    const r = acceptCompletion(typeAll(run, 'let a'), 4, 'abcdef')
    expect(r.pos).toBe(5)
  })

  it('reports typing speed, code speed and keys saved separately', () => {
    const { run } = setup('const a;')
    let r = typeAll(run, 'co')
    r = acceptCompletion(r, 0, 'const')
    r = typeAll(r, ' a;')
    const res = summarize(r, 6, [])
    // Typed: "co" + " a;" = 5 chars; on screen: 8 chars.
    expect(res.wpm).toBeCloseTo(5 / 5 / 0.1)
    expect(res.codeWpm).toBeCloseTo(8 / 5 / 0.1)
    expect(res.keysSaved).toBe(2)
  })
})

describe('vocabulary packs and members (for languages without a service)', () => {
  // A small language with packs, standing in for a future one such as Python.
  const toy: Language = {
    ...js,
    id: 'toy',
    completion: {
      packs: [
        {
          name: 'builtins',
          globals: [
            { label: 'setTimeout', kind: 'function' },
            { label: 'console', kind: 'variable' },
            { label: 'Math', kind: 'variable' },
          ],
          members: {
            console: [{ label: 'log', kind: 'method' }],
            Math: [
              { label: 'max', kind: 'method' },
              { label: 'min', kind: 'method' },
            ],
            '*': [
              { label: 'filter', kind: 'method' },
              { label: 'then', kind: 'method' },
            ],
          },
        },
        { name: 'react', detect: /from "react"/, globals: [{ label: 'useState', kind: 'function' }] },
      ],
    },
  }
  const toySetup = (code: string) => ({
    run: createRun(code, { autoIndent: true, autoClose: false }),
    cfg: buildSuggestConfig(code, toy, false),
  })

  it('suggests a pack\'s globals anywhere a word starts', () => {
    const { run, cfg } = toySetup('setTimeout(f, 1);')
    expect(labels(typeAll(run, 'setT'), cfg)[0]).toBe('setTimeout')
  })

  it('opens member suggestions right after a dot, for a known receiver only', () => {
    const { run, cfg } = toySetup('Math.max(a, b);')
    const items = labels(typeAll(run, 'Math.'), cfg)
    expect(items).toEqual(['max', 'min'])
  })

  it('shows "*" members plus typed words for an unknown receiver', () => {
    const { run, cfg } = toySetup('const list = [];\nlist.filter(Boolean);')
    expect(labels(typeAll(run, 'const list = [];\nlist.filt'), cfg)[0]).toBe('filter')
    expect(labels(typeAll(run, 'const list = [];\nlist.'), cfg)).toContain('list')
  })

  it('treats a dot after ) as a member access with an unknown receiver', () => {
    const { run, cfg } = toySetup('f().then(g);')
    expect(suggestContext(typeAll(run, 'f().'), cfg)).toMatchObject({ receiver: '' })
  })

  it('does not open after a spread or inside a number', () => {
    let { run, cfg } = toySetup('[...items]')
    expect(suggestContext(typeAll(run, '[...'), cfg)).toBeNull()
    ;({ run, cfg } = toySetup('x = 0.5;'))
    expect(suggestContext(typeAll(run, 'x = 0.'), cfg)).toBeNull()
  })

  it('treats a chain continued on a new line as member access', () => {
    const { run, cfg } = toySetup('const t = todos\n  .filter(Boolean);')
    expect(labels(typeAll(run, 'const t = todos\n.fil'), cfg)).toContain('filter')
  })

  it('supports optional chaining', () => {
    const { run, cfg } = toySetup('console?.log(x);')
    expect(labels(typeAll(run, 'console?.'), cfg)).toContain('log')
  })

  it('switches a pack on only when the snippet matches its detect pattern, and labels its items', () => {
    const withReact = toySetup('import { useState } from "react";\nuseState(0);')
    const r = typeAll(withReact.run, 'import { useState } from "react";\nuseS')
    expect(list(r, withReact.cfg).find((x) => x.label === 'useState')).toMatchObject({ kind: 'function', detail: 'react' })
    expect(toySetup('useState(0);').cfg.globals.some((g) => g.label === 'useState')).toBe(false)
  })

  it('basic suggestions never carry commit characters; only a service knows where names are declared', () => {
    const { run, cfg } = toySetup('Math.max(a, b);')
    expect(list(typeAll(run, 'Math.'), cfg).every((x) => !x.commit)).toBe(true)
  })

  it('puts names from the file before globals and keywords on a tie, then sorts alphabetically', () => {
    const { run, cfg } = toySetup('const counter = 1;\ncounter;')
    const items = labels(typeAll(run, 'const counter = 1;\nco'), cfg)
    expect(items[0]).toBe('counter')
    expect(items.indexOf('console')).toBeLessThan(items.indexOf('const'))
  })
})

describe('ranking', () => {
  it("ranks a fully typed word above longer words it starts, like VS Code's boostFullMatch", () => {
    expect(fuzzyMatch('fetch', 'fetch')!.score).toBeGreaterThan(fuzzyMatch('fetch', 'fetchUser')!.score)
  })
})

describe('Python vocabulary packs', () => {
  const py = getLanguage('python')
  const pySetup = (code: string) => ({
    run: createRun(code, { autoIndent: true, autoClose: false }),
    cfg: buildSuggestConfig(code, py, false),
  })

  it('offers built-ins everywhere', () => {
    const { run, cfg } = pySetup('total = len(items)')
    expect(labels(typeAll(run, 'total = le'), cfg)).toContain('len')
  })

  it('offers a module\'s members after "import json" and "json."', () => {
    const { run, cfg } = pySetup('import json\ndata = json.loads(text)')
    expect(labels(typeAll(run, 'import json\ndata = json.'), cfg)).toEqual(expect.arrayContaining(['loads', 'dumps']))
  })

  it('makes names from "from collections import ..." available, but only when imported', () => {
    const withImport = pySetup('from collections import Counter\ncounts = Counter(words)')
    const r = typeAll(withImport.run, 'from collections import Counter\ncounts = Cou')
    expect(labels(r, withImport.cfg)).toContain('Counter')
    expect(pySetup('counts = Counter(words)').cfg.globals.some((g) => g.label === 'Counter')).toBe(false)
  })

  it('offers os.path members after "os.path."', () => {
    const { run, cfg } = pySetup('import os\np = os.path.join(a, b)')
    expect(labels(typeAll(run, 'import os\np = os.path.'), cfg)).toContain('join')
  })
})
