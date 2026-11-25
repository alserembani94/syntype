/**
 * The typing reducer and a completion service that starts while the player is
 * already typing (TypeScript's loads on the first key): the word in progress
 * must get the service's suggestions once it's ready, not lose its list.
 */
import { describe, expect, it } from 'vitest'
import { getLanguage } from '../languages'
import { buildSuggestConfig } from './suggest'
import { init, reducer, type TestState } from './typing'
import type { CompletionService, ServiceStatus } from './service'

const lang = getLanguage('typescript')
const snippet = { name: 'debounce.ts', code: 'function debounce(fn: () => void) {\n  return fn\n}\n', length: 'short' as const }

function start(status: ServiceStatus) {
  const service: CompletionService = { status: () => status, onStatus: () => () => {}, complete: () => Promise.reject(new Error('answered by the test')) }
  const suggest = buildSuggestConfig(snippet.code, lang, false)!
  suggest.service = service
  return init(snippet, { autoIndent: true, autoClose: true, suggest }, 0)
}
const type = (s: TestState, text: string) => [...text].reduce((st, ch, i) => reducer(st, { type: 'key', ch, now: 100 + i * 120 }), s)
const entries = [
  { name: 'function', kind: 'keyword' as const, sortText: '15' },
  { name: 'fetch', kind: 'function' as const, sortText: '11' },
  { name: 'finally', kind: 'keyword' as const, sortText: '15' },
]

describe('a completion service that becomes ready mid-word', () => {
  it('takes over the word in progress: asked straight away, its answer filtered by the letters typed', () => {
    let s = type(start('starting'), 'fun')
    // While it starts: the basic list, from keywords.
    expect(s.suggest?.items.map((i) => i.label)).toContain('function')
    expect(s.suggest?.entries).toBeUndefined()

    s = reducer(s, { type: 'serviceStatus', ready: true })
    // Asked about the same word at once; the basic list stays until the answer comes.
    expect(s.request).toMatchObject({ start: 0 })
    expect(s.suggest?.items.map((i) => i.label)).toContain('function')

    s = reducer(s, { type: 'serviceResult', id: s.request!.id, response: { entries } })
    expect(s.suggest?.entries).toBeDefined()
    expect(s.suggest?.items.map((i) => i.label)).toEqual(['function'])

    // And it keeps filtering as the word grows.
    s = type(s, 'c')
    expect(s.suggest?.items.map((i) => i.label)).toEqual(['function'])
  })

  it('leaves a dismissed list dismissed, as VS Code does', () => {
    let s = type(start('starting'), 'fun')
    s = reducer(s, { type: 'dismiss' })
    s = reducer(s, { type: 'serviceStatus', ready: true })
    expect(s.request).toBeNull()
    expect(s.suggest).toBeNull()
  })

  it('a service that fails leaves the basic suggestions to carry on', () => {
    let s = type(start('ready'), 'f')
    s = reducer(s, { type: 'serviceStatus', ready: false })
    expect(s.request).toBeNull()
    s = type(s, 'u')
    expect(s.suggest?.items.map((i) => i.label)).toContain('function')
  })
})
