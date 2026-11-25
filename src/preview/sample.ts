/**
 * Sample leaderboards for the preview page (no server): made-up players and
 * scores on every snippet, and replays typed through the game's own reducer,
 * so they play back exactly as real ones do.
 */
import type { Language } from '../languages'
import { computePairs } from '../lib/pairs'
import { encodeLog, fingerprint, type LogEntry } from '../lib/runcore'
import { init, reducer } from '../lib/typing'
import { aidsOf } from '../lib/aids'
import type { Board, BoardReplay, BoardRow, LanguageBoards } from '../lib/boards'

const NAMES = [
  'LinusFast', 'ada-lovelace', 'grace-417', 'kernel_panic', 'tabs4ever', 'Margaret H', 'segfault', 'nullish',
  'Quine', 'curly-brace', 'monad_maria', 'bitshift', 'Rustacean', 'gopher-jo', 'lambda_lu', 'yaml-yusuf',
  'COBOLd', 'ptr_arith', 'regex-ria', 'deno-dan', 'heap_hana', 'sudo-sam', 'byte_bella', 'atif',
]
export const ME = { id: 'p-me', name: 'You (sample)' }

let seed = 20261125
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
const AIDS = ['111', '111', '110', '110', '100', '000', '011']

interface Sample {
  boards: Map<string, Board>
  /** The sample player's own row, on boards where they placed. */
  mine: Map<string, BoardRow>
  languages: Map<string, LanguageBoards>
  runs: Map<string, { fp: string; lang: Language; row: BoardRow }>
}

/** Every board: how many players depends on the snippet; the fastest have replays. */
export async function buildSample(languages: Language[]): Promise<Sample> {
  const sample: Sample = { boards: new Map(), mine: new Map(), languages: new Map(), runs: new Map() }
  const day = 86_400_000
  const now = Date.now()
  for (const lang of languages) {
    const overview: LanguageBoards = { language: lang.id, snippets: [], archived: [] }
    for (const [i, s] of lang.snippets.entries()) {
      const fp = await fingerprint(s.code)
      // Popular first snippets, quieter later ones, and a few with no runs yet.
      const count = i % 5 === 4 ? 0 : Math.max(1, Math.round((28 - i * 2) * (0.5 + rand())))
      const base = { short: 92, medium: 84, long: 76 }[s.length] * (lang.id === 'brainfuck' || lang.id === 'cobol' ? 0.7 : 1)
      const players = [...NAMES].sort(() => rand() - 0.5).slice(0, Math.min(count, NAMES.length))
      const rows: BoardRow[] = players
        .map((name) => ({
          rank: 0,
          player: { id: `p-${name}`, name },
          wpm: Math.max(28, base + (rand() - 0.35) * 70),
          accuracy: Math.min(100, 86 + rand() * 14),
          aids: pick(AIDS),
          finishedAt: new Date(now - rand() * 40 * day).toISOString(),
          runId: `run-${lang.id}-${i}-${name}`,
          hasLog: true,
        }))
        .sort((a, b) => b.wpm - a.wpm || b.accuracy - a.accuracy)
      rows.forEach((r, k) => {
        r.rank = k + 1
        r.hasLog = k < 20
        sample.runs.set(r.runId, { fp, lang, row: r })
      })
      // The sample player: in the top 15 on some boards, further down on others.
      if (count > 0 && i % 3 !== 2) {
        const rank = i % 3 === 0 ? Math.min(rows.length + 1, 4) : rows.length + 1
        const wpm = rank <= rows.length ? rows[rank - 1].wpm + 0.5 : Math.max(20, (rows.at(-1)?.wpm ?? 60) - 6)
        const mine: BoardRow = { rank, player: ME, wpm, accuracy: 95.2, aids: '110', finishedAt: new Date(now - 2 * day).toISOString(), runId: `run-${lang.id}-${i}-me`, hasLog: rank <= 20 }
        rows.splice(rank - 1, 0, mine)
        rows.forEach((r, k) => (r.rank = k + 1))
        sample.mine.set(fp, mine)
        sample.runs.set(mine.runId, { fp, lang, row: mine })
      }
      sample.boards.set(fp, { snippet: { fingerprint: fp, language: lang.id, name: s.name, length: s.length, current: true }, aids: 'any', rows })
      overview.snippets.push({ fingerprint: fp, name: s.name, length: s.length, top: rows[0] ? { name: rows[0].player.name, wpm: rows[0].wpm } : null })
    }
    // One language shows an older version of a snippet, with its closed board.
    if (lang.id === 'python') {
      const old = lang.snippets[0]
      const code = old.code.replace(/\n/, '\n\n')
      const fp = await fingerprint(code)
      const rows: BoardRow[] = ['grace-417', 'Quine', 'atif'].map((name, k) => ({
        rank: k + 1,
        player: { id: `p-${name}`, name },
        wpm: 88 - k * 9,
        accuracy: 97 - k,
        aids: '110',
        finishedAt: new Date(now - (60 + k) * day).toISOString(),
        runId: `run-old-${name}`,
        hasLog: true,
      }))
      rows.forEach((r) => sample.runs.set(r.runId, { fp, lang, row: r }))
      sample.boards.set(fp, { snippet: { fingerprint: fp, language: lang.id, name: old.name, length: old.length, current: false, code }, aids: 'any', rows })
      overview.archived.push({ fingerprint: fp, name: old.name, length: old.length, since: new Date(now - 70 * day).toISOString() })
    }
    sample.languages.set(lang.id, overview)
  }
  return sample
}

/** A run typed through the game's reducer at a human pace, with a typo or two fixed on the way. */
function typeRun(lang: Language, code: string, aidsKey: string, targetWpm: number): LogEntry[] {
  const aids = aidsOf(aidsKey)
  const pairs = aids.autoClose ? computePairs(code, lang) : undefined
  let s = init({ name: 'replay', code, length: 'short' }, { autoIndent: aids.autoIndent, autoClose: aids.autoClose, pairs, suggest: null }, 0)
  const gap = 12_000 / targetWpm
  let now = 1000
  let nextTick = 0
  for (let guard = 0; s.phase !== 'done' && guard < 20_000; guard++) {
    now += gap * (0.45 + rand() * 1.1) + (rand() < 0.04 ? 400 : 0)
    if (s.phase === 'running') {
      while (now >= s.startedAt + nextTick + 1000) {
        nextTick += 1000
        s = reducer(s, { type: 'tick', now: s.startedAt + nextTick })
      }
    }
    const expected = s.run.chars[s.run.pos]
    if (rand() < 0.015 && expected !== '\n') {
      s = reducer(s, { type: 'key', ch: expected === 'x' ? 'z' : 'x', now })
      now += 180 + rand() * 150
      s = reducer(s, { type: 'back', word: false, now })
      now += gap
    }
    s = reducer(s, { type: 'key', ch: expected, now })
  }
  return encodeLog(s.log)
}

export function replayFor(sample: Sample, runId: string): BoardReplay | null {
  const found = sample.runs.get(runId)
  if (!found || !found.row.hasLog) return null
  const board = sample.boards.get(found.fp)!
  const code = board.snippet.code ?? found.lang.snippets.find((x) => x.name === board.snippet.name)!.code
  return {
    runId,
    player: found.row.player,
    wpm: found.row.wpm,
    accuracy: found.row.accuracy,
    aids: found.row.aids,
    finishedAt: found.row.finishedAt,
    snippet: { fingerprint: found.fp, language: found.lang.id, name: board.snippet.name, length: board.snippet.length, code },
    log: typeRun(found.lang, code, found.row.aids, found.row.wpm),
  }
}
