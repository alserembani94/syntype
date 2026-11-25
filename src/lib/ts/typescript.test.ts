import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createCompleter } from './completer'
import { EXPRESS_D_TS, HOST_D_TS, REACT_D_TS } from './stubs'
import { init, reducer, type Action, type TestState } from '../../hooks/useTypingTest'
import { buildSuggestConfig } from '../suggest'
import { computePairs } from '../pairs'
import { counts } from '../engine'
import { getLanguage } from '../../languages'
import type { CompletionService, ServiceResponse } from '../service'
import type { Language, Snippet } from '../../languages/types'

// The same ES2022 libraries the worker bundles, read from disk.
const libDir = path.join(process.cwd(), 'node_modules/ts-lang/lib')
const libs: Record<string, string> = {}
const loadLib = (name: string) => {
  const file = `lib.${name}.d.ts`
  if (libs[file]) return
  libs[file] = fs.readFileSync(path.join(libDir, file), 'utf8')
  for (const m of libs[file].matchAll(/<reference lib="([^"]+)"/g)) loadLib(m[1])
}
loadLib('es2022')
const completer = createCompleter({
  ...libs,
  'host.d.ts': HOST_D_TS,
  'react.d.ts': REACT_D_TS,
  'express.d.ts': EXPRESS_D_TS,
})

const complete = (code: string, trigger?: string, offset = code.length, mode = 'typescript') =>
  completer.complete({ text: code, offset, trigger, mode })
const completeJs = (code: string, trigger?: string) => complete(code, trigger, code.length, 'javascript')
const names = (r: ServiceResponse) => r.entries.map((e) => e.name)

describe('TypeScript completer', () => {
  const user = 'interface Address { city: string }\ninterface User { id: number; name: string; email?: string; address: Address }\n'

  it('knows the members of types declared in the snippet', () => {
    expect(names(complete(user + 'declare const u: User;\nu.', '.'))).toEqual(
      expect.arrayContaining(['id', 'name', 'email', 'address']),
    )
    expect(names(complete(user + 'declare const u: User;\nu.address.', '.'))).toEqual(['city'])
  })

  it('infers callback parameters from generic arrays', () => {
    const r = complete(user + 'declare const users: User[];\nusers.filter((x) => x.', '.')
    expect(names(r)).toContain('address')
  })

  it('marks optional members, as VS Code shows them with "?"', () => {
    const r = complete(user + 'declare const u: User;\nu.', '.')
    expect(r.entries.find((e) => e.name === 'email')?.optional).toBe(true)
  })

  it('offers string-literal union members after a quote', () => {
    const r = complete('type Dir = "up" | "down";\nconst d: Dir = "', '"')
    expect(names(r).sort()).toEqual(['down', 'up'])
    expect(r.entries[0].commit).toBeUndefined()
  })

  it("has VS Code's commit characters, except where a new name is declared", () => {
    const member = complete(user + 'declare const u: User;\nu.', '.')
    expect(member.entries[0].commit).toEqual(['.', ',', ';', '('])
    const decl = complete('function f(a')
    expect(decl.entries.every((e) => !e.commit)).toBe(true)
  })

  it('understands React hooks through the stub', () => {
    const r = complete('import { useState } from "react";\nconst [items] = useState<string[]>([]);\nitems.', '.')
    expect(names(r)).toContain('filter')
  })
})

describe('JavaScript through the TypeScript service', () => {
  it('infers types from plain JavaScript', () => {
    const r = completeJs('const names = [1, 2].map((n) => String(n));\nnames.', '.')
    expect(names(r)).toContain('filter')
    expect(names(r)).not.toContain('toFixed')
  })

  it('knows object shapes and class members', () => {
    // JavaScript also lists unresolved words (here "point" itself), as VS Code shows them.
    expect(names(completeJs('const point = { x: 1, y: 2 };\npoint.', '.'))).toEqual(expect.arrayContaining(['x', 'y']))
    const cls = 'class Stack {\n  #items = [];\n  push(item) {\n    this.'
    expect(names(completeJs(cls, '.'))).toContain('push')
  })

  it('types Express handlers through the stub', () => {
    const code = 'import express from "express";\nconst app = express();\napp.get("/", (req, res) => res.'
    expect(names(completeJs(code, '.'))).toEqual(expect.arrayContaining(['status', 'json', 'send']))
    expect(names(completeJs('import express from "express";\nconst app = express();\napp.', '.'))).toContain('listen')
  })

  it('offers unresolved names as plain words without commit characters, like VS Code', () => {
    const r = completeJs('const total = items.reduce((sum, item) => sum + item.', '.')
    const word = r.entries.find((e) => e.kind === 'word')
    expect(word).toBeDefined()
    expect(word?.commit).toBeUndefined()
  })

  it('shows no list where a new parameter is declared, so "(a," never commits a word', () => {
    expect(completeJs('function f(a').entries.every((e) => !e.commit)).toBe(true)
  })
})

// --- Driving the real reducer with a synchronous service ---

const syncService: CompletionService = {
  status: () => 'ready',
  onStatus: () => () => {},
  complete: () => Promise.reject(new Error('the harness answers requests itself')),
}

function start(lang: Language, snippet: Snippet, service: boolean): TestState {
  const suggest = buildSuggestConfig(snippet.code, lang, false)
  if (service) suggest.service = syncService
  return init(
    snippet,
    { autoIndent: true, autoClose: true, pairs: computePairs(snippet.code, lang), suggest },
    0,
  )
}

/** Dispatches, then answers any service request on the spot, as the worker would. */
function step(s: TestState, a: Action): TestState {
  let next = reducer(s, a)
  if (next.request) {
    const { id, text, offset, trigger, mode } = next.request
    next = reducer(next, { type: 'serviceResult', id, response: completer.complete({ text, offset, trigger, mode }) })
  }
  return next
}

const key = (ch: string): Action => ({ type: 'key', ch, now: 1 })

/** Plays a snippet to the end. `useSuggestions` accepts with Tab whenever the selected item is the right word. */
function play(lang: Language, snippet: Snippet, useSuggestions: boolean, service = true) {
  let s = start(lang, snippet, service)
  let accepts = 0
  for (let guard = 0; s.phase !== 'done' && guard < 5000; guard++) {
    const { run } = s
    const ch = run.chars[run.pos]
    if (useSuggestions && s.suggest) {
      const item = s.suggest.items[s.suggest.selected]
      const text = item.insertText ?? item.label
      const target = run.chars.slice(s.suggest.start, s.suggest.start + text.length).join('')
      const after = run.chars[s.suggest.start + text.length]
      if (text === target && !/[\w$]/.test(after ?? '') && s.suggest.start + text.length > run.pos) {
        s = step(s, { type: 'accept', now: 1 })
        accepts++
        continue
      }
    }
    if (run.states[run.pos] === 'pending' && ch === '\n') {
      // An open list would take ↓, so close it first, as a VS Code user would.
      if (s.suggest) s = step(s, { type: 'dismiss' })
      s = step(s, { type: 'move', dir: 'down', now: 1 })
    } else if (ch === '\n' && s.suggest) {
      // Enter would accept; a user who wants a new line presses Esc first.
      s = step(s, { type: 'dismiss' })
    } else s = step(s, key(ch))
  }
  return { state: s, accepts }
}

describe('playing every snippet with suggestions on', () => {
  const ts = getLanguage('typescript')
  const js = getLanguage('javascript')

  it.each(ts.snippets.map((s) => [s.name, s] as const))(
    'TypeScript %s: typing every character literally never lets a commit character insert a wrong word',
    (_, snippet) => {
      const { state } = play(ts, snippet, false)
      const bad = state.run.states.map((st, i) => (st === 'bad' ? i : -1)).filter((i) => i >= 0)
      if (bad.length) console.info(snippet.name, 'wrong at', JSON.stringify(state.run.chars.slice(bad[0] - 12, bad[0] + 8).join('')), 'typed', JSON.stringify(bad.map((i) => state.run.typed[i]).join('')))
      expect(state.phase).toBe('done')
      expect(counts(state.run).incorrect).toBe(0)
    },
  )

  it.each(js.snippets.map((s) => [s.name, s] as const))(
    'JavaScript %s: typing every character literally, with the TypeScript service',
    (_, snippet) => {
      const { state } = play(js, snippet, false)
      const bad = state.run.states.map((st, i) => (st === 'bad' ? i : -1)).filter((i) => i >= 0)
      if (bad.length) console.info(snippet.name, 'wrong at', JSON.stringify(state.run.chars.slice(bad[0] - 12, bad[0] + 8).join('')), 'typed', JSON.stringify(bad.map((i) => state.run.typed[i]).join('')))
      expect(state.phase).toBe('done')
      expect(counts(state.run).incorrect).toBe(0)
    },
  )

  it.each(js.snippets.map((s) => [s.name, s] as const))(
    'JavaScript %s: the same with basic suggestions (before the service is ready)',
    (_, snippet) => {
      const { state } = play(js, snippet, false, false)
      expect(state.phase).toBe('done')
      expect(counts(state.run).incorrect).toBe(0)
    },
  )

  it.each([
    ['TypeScript', ts, true],
    ['JavaScript', js, true],
    ['JavaScript (basic suggestions, before the service is ready)', js, false],
  ] as const)('accepting suggestions finishes every %s snippet without mistakes, and reports what it saved', (label, lang, service = true) => {
    let saved = 0
    let typed = 0
    for (const snippet of lang.snippets) {
      const { state } = play(lang, snippet, true, service)
      expect(state.phase, snippet.name).toBe('done')
      expect(counts(state.run).incorrect, snippet.name).toBe(0)
      saved += Math.max(0, counts(state.run).suggested - state.run.completions)
      typed += state.run.keystrokes
    }
    console.info(`${label} snippets with suggestions: ${typed} keystrokes, ${saved} saved`)
    expect(saved).toBeGreaterThan(0)
  })
})
