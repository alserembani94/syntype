/**
 * TypeScript's language service, as JavaScript and TypeScript use it: what it
 * offers in specific situations. Playthroughs of every snippet live in
 * src/languages/conformance.test.ts.
 */
import { describe, expect, it } from 'vitest'
import type { ServiceResponse } from '../service'
import { tsCompleter as completer } from '../../test/tsCompleter'

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
