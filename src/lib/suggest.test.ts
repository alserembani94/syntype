import { describe, expect, it } from 'vitest'
import { acceptCompletion, counts, createRun, typeChar, type Run } from './engine'
import { buildSuggestConfig, fuzzyMatch, getSuggestions, suggestContext, wordStart, type Suggestion } from './suggest'
import { summarize } from './stats'
import { getLanguage } from '../languages'

const js = getLanguage('javascript')
const typeAll = (run: Run, text: string) => [...text].reduce(typeChar, run)
const setup = (code: string) => ({
  run: createRun(code, { autoIndent: true, autoClose: false }),
  cfg: buildSuggestConfig(code, js),
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

describe('vocabulary packs and members', () => {
  it('suggests built-ins anywhere a word starts', () => {
    const { run, cfg } = setup('setTimeout(f, 1);')
    expect(labels(typeAll(run, 'setT'), cfg)[0]).toBe('setTimeout')
  })

  it('opens member suggestions right after a dot, for a known receiver only', () => {
    const { run, cfg } = setup('Math.max(a, b);')
    const items = labels(typeAll(run, 'Math.'), cfg)
    expect(items).toContain('max')
    expect(items).not.toContain('filter')
    expect(items).not.toContain('const')
  })

  it('shows common instance members plus typed words for an unknown receiver', () => {
    const { run, cfg } = setup('const list = [];\nlist.filter(Boolean);')
    const items = labels(typeAll(run, 'const list = [];\nlist.filt'), cfg)
    expect(items[0]).toBe('filter')
    expect(labels(typeAll(run, 'const list = [];\nlist.'), cfg)).toContain('list')
  })

  it('treats a dot after ) as a member access with an unknown receiver', () => {
    const { run, cfg } = setup('f().then(g);')
    expect(suggestContext(typeAll(run, 'f().'), cfg)).toMatchObject({ receiver: '' })
  })

  it('does not open after a spread or inside a number', () => {
    let { run, cfg } = setup('[...items]')
    expect(suggestContext(typeAll(run, '[...'), cfg)).toBeNull()
    ;({ run, cfg } = setup('x = 0.5;'))
    expect(suggestContext(typeAll(run, 'x = 0.'), cfg)).toBeNull()
  })

  it('treats a chain continued on a new line as member access', () => {
    const code = 'const t = todos\n  .filter(Boolean);'
    const { run, cfg } = setup(code)
    expect(labels(typeAll(run, 'const t = todos\n.fil'), cfg)).toContain('filter')
  })

  it('supports optional chaining', () => {
    const { run, cfg } = setup('console?.log(x);')
    expect(labels(typeAll(run, 'console?.'), cfg)).toContain('log')
  })

  it('switches library packs on only when the snippet imports them', () => {
    const withReact = setup('import { useState } from "react";\nuseState(0);')
    expect(withReact.cfg.globals.some((g) => g.label === 'useState')).toBe(true)
    const without = setup('useState(0);')
    expect(without.cfg.globals.some((g) => g.label === 'useState')).toBe(false)
  })

  it('labels where a suggestion comes from', () => {
    const { run, cfg } = setup('import { useState } from "react";\nuseS')
    const r = typeAll(run, 'import { useState } from "react";\n')
    const item = list(typeAll(r, 'useS'), cfg).find((s) => s.label === 'useState')
    expect(item).toMatchObject({ kind: 'function', detail: 'react' })
  })

  it('express gives app, req and res their members', () => {
    const code = 'import express from "express";\napp.get("/", (req, res) => res.json(1));'
    const { run, cfg } = setup(code)
    expect(labels(typeAll(run, 'import express from "express";\napp.'), cfg)).toContain('listen')
  })
})

describe('coverage of the JavaScript snippets', () => {
  /**
   * For every word in every snippet, checks whether suggestions could offer it
   * at the moment it's typed (playing the snippet through). Prints the misses so
   * it's clear which vocabulary to extend as snippets are added.
   */
  it('reports words suggestions cannot offer', () => {
    let words = 0
    let offered = 0
    const misses = new Map<string, number>()
    for (const s of js.snippets) {
      const cfg = buildSuggestConfig(s.code, js)
      let run = createRun(s.code, { autoIndent: true, autoClose: false })
      const re = /[A-Za-z_$][\w$]*/g
      let m: RegExpExecArray | null
      while ((m = re.exec(s.code))) {
        const at = m.index
        if (cfg.quiet[at]) continue
        while (run.pos < at + 1) run = typeChar(run, run.chars[run.pos])
        words++
        if (labels(run, cfg).includes(m[0])) offered++
        else misses.set(m[0], (misses.get(m[0]) ?? 0) + 1)
      }
    }
    const top = [...misses].sort((a, b) => b[1] - a[1]).slice(0, 15)
    console.info(`suggestions offer ${offered} of ${words} words (${Math.round((offered / words) * 100)}%). Most missed: ${top.map(([w, n]) => `${w}×${n}`).join(' ')}`)
    expect(offered / words).toBeGreaterThan(0.6)
  })
})

describe('ranking', () => {
  it('puts names from the file before globals and keywords on a tie, then sorts alphabetically', () => {
    const code = 'const counter = 1;\ncounter;'
    const { run, cfg } = setup(code)
    const items = labels(typeAll(run, 'const counter = 1;\nco'), cfg)
    expect(items[0]).toBe('counter')
    expect(items.indexOf('console')).toBeLessThan(items.indexOf('const'))
  })
})
