/**
 * Plays snippets through the real reducer, the way a person would, for tests.
 * A language with a completion service needs a synchronous stand-in for it
 * here (see TEST_COMPLETERS), since the real one runs in a browser worker.
 */
import { init, reducer, type Action, type TestState } from '../hooks/useTypingTest'
import { buildSuggestConfig } from '../lib/suggest'
import { computePairs } from '../lib/pairs'
import type { CompletionService } from '../lib/service'
import type { Completer } from '../lib/ts/completer'
import type { Language, Snippet } from '../languages/types'
import { tsCompleter } from './tsCompleter'

/** Node-side completers for languages that have a service, by language id. */
export const TEST_COMPLETERS: Record<string, Completer> = {
  javascript: tsCompleter,
  typescript: tsCompleter,
  playwright: tsCompleter,
}

const syncService: CompletionService = {
  status: () => 'ready',
  onStatus: () => () => {},
  complete: () => Promise.reject(new Error('the harness answers requests itself')),
}

export const hasService = (lang: Language) => !!lang.completion?.service

function start(lang: Language, snippet: Snippet, service: boolean): TestState {
  const suggest = buildSuggestConfig(snippet.code, lang, false)
  if (service) suggest.service = syncService
  return init(snippet, { autoIndent: true, autoClose: true, pairs: computePairs(snippet.code, lang), suggest }, 0)
}

/** Dispatches, then answers any service request on the spot, as the worker would. */
function step(lang: Language, s: TestState, a: Action): TestState {
  let next = reducer(s, a)
  if (next.request) {
    const completer = TEST_COMPLETERS[lang.id]
    if (!completer) throw new Error(`No test completer for ${lang.id}: add one to TEST_COMPLETERS`)
    const { id, text, offset, trigger, mode } = next.request
    next = reducer(next, { type: 'serviceResult', id, response: completer.complete({ text, offset, trigger, mode }) })
  }
  return next
}

/**
 * Plays a snippet to the end with auto-indent, auto-close and suggestions on.
 * `acceptSuggestions`: press Tab whenever the selected suggestion is exactly the
 * right word; otherwise every character is typed literally. `service`: use the
 * language's service (when it has one) or only basic suggestions, as while the
 * service is starting.
 */
export function play(lang: Language, snippet: Snippet, opts: { acceptSuggestions: boolean; service: boolean }) {
  let s = start(lang, snippet, opts.service && hasService(lang))
  for (let guard = 0; s.phase !== 'done' && guard < 10000; guard++) {
    const { run } = s
    const ch = run.chars[run.pos]
    if (opts.acceptSuggestions && s.suggest) {
      const item = s.suggest.items[s.suggest.selected]
      const text = item.insertText ?? item.label
      const target = run.chars.slice(s.suggest.start, s.suggest.start + text.length).join('')
      const after = run.chars[s.suggest.start + text.length]
      if (text === target && !/[\w$]/.test(after ?? '') && s.suggest.start + text.length > run.pos) {
        s = step(lang, s, { type: 'accept', now: 1 })
        continue
      }
    }
    if (run.states[run.pos] === 'pending' && ch === '\n') {
      // An open list would take ↓, so close it first, as a VS Code user would.
      if (s.suggest) s = step(lang, s, { type: 'dismiss' })
      s = step(lang, s, { type: 'move', dir: 'down', now: 1 })
    } else if (ch === '\n' && s.suggest) {
      // Enter would accept; someone who wants a new line presses Esc first.
      s = step(lang, s, { type: 'dismiss' })
    } else s = step(lang, s, { type: 'key', ch, now: 1 })
  }
  return s
}

/** Where the first wrong character is, for a readable failure message. */
export function firstMistake(s: TestState): string | null {
  const i = s.run.states.indexOf('bad')
  if (i < 0) return null
  const around = s.run.chars.slice(Math.max(0, i - 15), i + 10).join('')
  return `expected ${JSON.stringify(s.run.chars[i])}, got ${JSON.stringify(s.run.typed[i])} in …${JSON.stringify(around)}…`
}
