import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { BEST_LOGS_PER_SNIPPET, openHistory, RECENT_LOGS, snippetKey, type History } from './history'
import type { RunRecord } from './runlog'

let n = 0
/** A run record; each one finishes a minute after the previous. */
function run(over: Partial<RunRecord> = {}): RunRecord {
  n++
  return {
    id: `run-${n}`,
    language: 'python',
    snippet: 'clamp.py',
    fingerprint: 'abc',
    length: 'short',
    aids: { autoIndent: true, autoClose: true, autocomplete: true },
    wpm: 50,
    rawWpm: 55,
    accuracy: 96,
    consistency: 80,
    seconds: 20,
    finishedAt: new Date(Date.UTC(2026, 10, 25, 12, n)).toISOString(),
    log: [['k', 'd', 0], ['k', 'e', 90]],
    ...over,
  }
}

async function fresh(): Promise<History> {
  const h = await openHistory(new IDBFactory())
  if (!h) throw new Error('history did not open')
  return h
}

/** Ids of the runs whose logs are still stored. */
const withLogs = async (h: History) => (await h.runs()).filter((r) => r.hasLog).map((r) => r.id).sort()

describe('local history', () => {
  it('stores a run, newest first, with its log kept separately', async () => {
    const h = await fresh()
    const a = run()
    const b = run({ language: 'rust', snippet: 'add.rs' })
    await h.add(a)
    await h.add(b)
    const all = await h.runs()
    expect(all.map((r) => r.id)).toEqual([b.id, a.id])
    expect(all[0]).not.toHaveProperty('log')
    expect(all[0]).toMatchObject({ snippetKey: snippetKey(b), hasLog: true, wpm: 50 })
    expect(await h.log(a.id)).toEqual(a.log)
  })

  it('lists one language or one snippet', async () => {
    const h = await fresh()
    await h.add(run())
    await h.add(run({ snippet: 'greet.py' }))
    await h.add(run({ language: 'go', snippet: 'add.go' }))
    expect((await h.runs({ language: 'python' })).length).toBe(2)
    expect((await h.runs({ snippetKey: 'python/greet.py/abc' })).map((r) => r.snippet)).toEqual(['greet.py'])
  })

  it(`keeps logs for each snippet's best ${BEST_LOGS_PER_SNIPPET} runs and the last ${RECENT_LOGS}, and every result`, async () => {
    const h = await fresh()
    const speeds = [70, 40, 90, 45, 85, 41, 42, 43, 44, 46, 47, 48, 49, 50, 51]
    const runs = speeds.map((wpm) => run({ wpm }))
    for (const r of runs) await h.add(r)
    const best = [...runs].sort((a, b) => b.wpm - a.wpm).slice(0, BEST_LOGS_PER_SNIPPET)
    const recent = runs.slice(-RECENT_LOGS)
    const expected = [...new Set([...best, ...recent].map((r) => r.id))].sort()
    expect(await withLogs(h)).toEqual(expected)
    expect((await h.runs()).length).toBe(speeds.length)
    // Dropped logs are really gone, not just marked.
    const dropped = runs.find((r) => !expected.includes(r.id))!
    expect(await h.log(dropped.id)).toBeUndefined()
  })

  it("keeps another snippet's best log after it stops being recent", async () => {
    const h = await fresh()
    const other = run({ snippet: 'greet.py', wpm: 30 })
    await h.add(other)
    for (let i = 0; i < RECENT_LOGS + 2; i++) await h.add(run({ wpm: 60 + i }))
    expect(await withLogs(h)).toContain(other.id)
  })

  it('a fast but inaccurate run is not one of the best', async () => {
    const h = await fresh()
    const sloppy = run({ wpm: 200, accuracy: 60 })
    await h.add(sloppy)
    for (let i = 0; i < RECENT_LOGS + 3; i++) await h.add(run({ wpm: 50 + i }))
    expect(await withLogs(h)).not.toContain(sloppy.id)
  })

  it('a new version of a snippet keeps its own best logs', async () => {
    const h = await fresh()
    const old = run({ fingerprint: 'old', wpm: 40 })
    await h.add(old)
    for (let i = 0; i < RECENT_LOGS + 2; i++) await h.add(run({ fingerprint: 'new', wpm: 90 + i }))
    // The old text's only run is still that version's best.
    expect(await withLogs(h)).toContain(old.id)
  })

  it('opens to nothing where the browser has no storage, so the game carries on', async () => {
    expect(await openHistory(null)).toBeNull()
    const refusing = { open: () => { throw new DOMException('denied', 'SecurityError') } } as unknown as IDBFactory
    expect(await openHistory(refusing)).toBeNull()
    // Where even reading window.indexedDB throws.
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB')
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get: () => { throw new DOMException('blocked', 'SecurityError') } })
    try {
      expect(await openHistory()).toBeNull()
    } finally {
      if (saved) Object.defineProperty(globalThis, 'indexedDB', saved)
      else delete (globalThis as { indexedDB?: unknown }).indexedDB
    }
  })

  it('exports everything and imports it into another browser', async () => {
    const a = await fresh()
    const runs = [run(), run({ language: 'go', snippet: 'add.go' }), run({ wpm: 70 })]
    for (const r of runs) await a.add(r)
    const file = JSON.parse(JSON.stringify(await a.exportAll()))
    expect(file).toMatchObject({ format: 'syntype-history', version: 1 })
    expect(file.runs.length).toBe(3)

    const b = await fresh()
    expect(await b.importAll(file)).toEqual({ added: 3, skipped: 0 })
    expect((await b.runs()).map((r) => r.id).sort()).toEqual(runs.map((r) => r.id).sort())
    expect(await b.log(runs[2].id)).toEqual(runs[2].log)
    // Importing the same file again adds nothing.
    expect(await b.importAll(file)).toEqual({ added: 0, skipped: 3 })
  })

  it('refuses a file that is not a history export, and skips runs that are malformed', async () => {
    const h = await fresh()
    await expect(h.importAll({ hello: 'world' })).rejects.toThrow('not a Syntype history file')
    const file = { format: 'syntype-history', version: 1, exportedAt: '', runs: [{ id: 'x', wpm: 'fast' }, { ...run(), log: undefined }], logs: [] }
    expect(await h.importAll(file)).toEqual({ added: 1, skipped: 1 })
    // An imported run without a log is stored without one.
    expect((await h.runs())[0].hasLog).toBe(false)
  })

  it('applies the log rules to imported runs', async () => {
    const source = await fresh()
    // Logs are only pruned per snippet as runs are added, so put many runs of one snippet in a file by hand.
    const many = Array.from({ length: 20 }, (_, i) => run({ wpm: 40 + i }))
    const file = { format: 'syntype-history', version: 1, exportedAt: '', runs: many.map((r) => ({ ...r, log: undefined })), logs: many.map((r) => ({ id: r.id, log: r.log })) }
    source.close()
    const h = await fresh()
    await h.importAll(file)
    const kept = await withLogs(h)
    expect(kept.length).toBeLessThanOrEqual(BEST_LOGS_PER_SNIPPET + RECENT_LOGS)
    expect(kept).toContain(many[19].id) // the fastest, and the newest
  })

  it('clears one language, or everything', async () => {
    const h = await fresh()
    const py = run()
    const go = run({ language: 'go', snippet: 'add.go' })
    await h.add(py)
    await h.add(go)
    await h.clear('python')
    expect((await h.runs()).map((r) => r.id)).toEqual([go.id])
    expect(await h.log(py.id)).toBeUndefined()
    await h.clear()
    expect(await h.runs()).toEqual([])
    expect(await h.log(go.id)).toBeUndefined()
  })
})
