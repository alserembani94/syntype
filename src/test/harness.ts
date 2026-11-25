/**
 * Plays snippets through the real reducer, the way a person would, for tests.
 * A language with a completion service needs a synchronous stand-in for it
 * here (see TEST_COMPLETERS), since the real one runs in a browser worker.
 */
import { init, reducer, type Action, type TestState } from '../lib/typing'
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

export interface Aids {
  autoIndent: boolean
  autoClose: boolean
  autocomplete: boolean
}
const ALL_AIDS: Aids = { autoIndent: true, autoClose: true, autocomplete: true }

function start(lang: Language, snippet: Snippet, service: boolean, aids: Aids): TestState {
  const suggest = aids.autocomplete ? buildSuggestConfig(snippet.code, lang, false) : null
  if (suggest && service) suggest.service = syncService
  const pairs = aids.autoClose ? computePairs(snippet.code, lang) : undefined
  return init(snippet, { autoIndent: aids.autoIndent, autoClose: aids.autoClose, pairs, suggest }, 0)
}

/**
 * A human-like typist, seeded so a test always plays the same way: 70-110 ms
 * between keys, a typo now and then fixed with Backspace, the once-a-second
 * sample, and one pause partway through.
 */
export interface Typist {
  seed: number
  /** Chance of a typo before a character, e.g. 0.03. */
  typos: number
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
export function play(
  lang: Language,
  snippet: Snippet,
  opts: { acceptSuggestions: boolean; service: boolean; aids?: Aids; typist?: Typist },
) {
  const aids = opts.aids ?? ALL_AIDS
  let s = start(lang, snippet, opts.service && hasService(lang), aids)
  // Without a typist, every action happens at time 1, as the rule tests need nothing more.
  let now = 1
  let seed = opts.typist?.seed ?? 0
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
  let nextTick = 1000
  let pendingBreaks = 0
  let paused = false
  /** The once-a-second samples due by `t`, in time order, as the browser's timer delivers them. */
  const ticksUntil = (t: number) => {
    while (opts.typist && s.phase === 'running' && !s.pausedAt && t >= s.startedAt + nextTick) {
      s = step(lang, s, { type: 'tick', now: s.startedAt + nextTick })
      nextTick += 1000
    }
  }
  for (let guard = 0; s.phase !== 'done' && guard < 10000; guard++) {
    if (opts.typist) {
      now += 70 + Math.floor(rand() * 40)
      ticksUntil(now)
      if (s.phase === 'running') {
        if (!paused && s.run.pos > s.run.chars.length / 2) {
          // Away from the page for 3 s: paused time never counts.
          paused = true
          s = step(lang, s, { type: 'pause', now })
          now += 3000
          s = step(lang, s, { type: 'resume', now })
          nextTick += 3000
        }
      }
    }
    const { run } = s
    const ch = run.chars[run.pos]
    if (opts.typist && ch !== '\n' && run.states[run.pos] !== 'pending' && !s.suggest && rand() < opts.typist.typos) {
      s = step(lang, s, { type: 'key', ch: ch === 'q' ? 'z' : 'q', now })
      now += 120
      ticksUntil(now)
      s = step(lang, s, { type: 'back', word: false, now })
      now += 90
      continue
    }
    if (opts.acceptSuggestions && s.suggest) {
      const item = s.suggest.items[s.suggest.selected]
      const text = item.insertText ?? item.label
      const target = run.chars.slice(s.suggest.start, s.suggest.start + text.length).join('')
      const after = run.chars[s.suggest.start + text.length]
      if (text === target && !/[\w$]/.test(after ?? '') && s.suggest.start + text.length > run.pos) {
        s = step(lang, s, { type: 'accept', now })
        continue
      }
    }
    if (run.states[run.pos] === 'pending' && ch === '\n') {
      // At a line break the editor already inserted, players press Enter or ↓; take turns, so every
      // snippet exercises both. An open list would take either key, so close it first.
      if (s.suggest) s = step(lang, s, { type: 'dismiss' })
      s = step(lang, s, (pendingBreaks++ % 2 === 0 ? { type: 'key', ch: '\n', now } : { type: 'move', dir: 'down', now }) as Action)
    } else if (ch === '\n' && s.suggest) {
      // Enter would accept; someone who wants a new line presses Esc first.
      s = step(lang, s, { type: 'dismiss' })
    } else s = step(lang, s, { type: 'key', ch, now })
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
