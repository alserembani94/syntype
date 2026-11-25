/**
 * Local history: every finished run, kept in the browser's IndexedDB
 * (docs/leaderboard.md, "Personal board"). Results are kept for every run;
 * keystroke logs only for each snippet's best 3 runs and the last 10 runs, so
 * storage stays small however much someone plays. Nothing here leaves the
 * device.
 *
 * Storage can be missing or refused (private windows, sandboxed pages, a full
 * disk). openHistory() then resolves to null and the game carries on without it.
 */
import type { LogEntry, RunRecord } from './runlog'
import type { Submission } from './submit'
import { MIN_ACCURACY_FOR_BEST } from './stats'

const DB_NAME = 'syntype'
const DB_VERSION = 1
/** Logs kept per snippet, best first. */
export const BEST_LOGS_PER_SNIPPET = 3
/** Logs kept for the most recent runs, whatever their score. */
export const RECENT_LOGS = 10

/** A run as stored: its record without the log, which is kept separately. */
export interface StoredRun extends Omit<RunRecord, 'log'> {
  /** "language/snippet/fingerprint": one snippet's exact text. */
  snippetKey: string
  hasLog: boolean
  /** What happened when it was sent to the leaderboard; missing if it wasn't. */
  submission?: Submission
}

export const snippetKey = (r: Pick<RunRecord, 'language' | 'snippet' | 'fingerprint'>) => `${r.language}/${r.snippet}/${r.fingerprint}`

/** Best first: accurate runs by WPM, then earlier first on a tie. */
export function byBest(a: StoredRun, b: StoredRun): number {
  const accurate = (r: StoredRun) => (r.accuracy >= MIN_ACCURACY_FOR_BEST ? 1 : 0)
  return accurate(b) - accurate(a) || b.wpm - a.wpm || a.finishedAt.localeCompare(b.finishedAt)
}

const request = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'))
  })

export interface History {
  /** Saves a finished run, then drops logs that are no longer among the kept ones. */
  add(record: RunRecord): Promise<void>
  /** Notes what happened when a run was sent to the leaderboard. */
  setSubmission(id: string, submission: Submission): Promise<void>
  /** Runs, newest first; optionally one language's or one snippet's. */
  runs(filter?: { language?: string; snippetKey?: string }): Promise<StoredRun[]>
  /** A run's keystroke log, if it was kept. */
  log(id: string): Promise<LogEntry[] | undefined>
  /** Everything, as a file's contents, to keep or move to another device. */
  exportAll(): Promise<HistoryFile>
  /** Adds the runs from an exported file (runs already here are kept), then applies the log rules. */
  importAll(file: unknown): Promise<{ added: number; skipped: number }>
  /** Deletes every run and log, or one language's. */
  clear(language?: string): Promise<void>
  close(): void
}

/** An exported history file. */
export interface HistoryFile {
  format: 'syntype-history'
  version: 1
  exportedAt: string
  runs: StoredRun[]
  logs: { id: string; log: LogEntry[] }[]
}

/** Checks a run read from a file has the shape the board relies on. */
function validRun(r: unknown): r is StoredRun {
  const x = r as StoredRun
  return (
    !!x &&
    typeof x.id === 'string' &&
    typeof x.language === 'string' &&
    typeof x.snippet === 'string' &&
    typeof x.fingerprint === 'string' &&
    ['short', 'medium', 'long'].includes(x.length) &&
    typeof x.wpm === 'number' &&
    Number.isFinite(x.wpm) &&
    typeof x.accuracy === 'number' &&
    typeof x.seconds === 'number' &&
    typeof x.finishedAt === 'string' &&
    !Number.isNaN(Date.parse(x.finishedAt)) &&
    !!x.aids &&
    ['autoIndent', 'autoClose', 'autocomplete'].every((k) => typeof x.aids[k as keyof typeof x.aids] === 'boolean')
  )
}

/** Run ids whose logs are kept: each snippet's best few, and the most recent few overall. */
function logsToKeep(all: StoredRun[]): Set<string> {
  const keep = new Set<string>()
  const bySnippet = new Map<string, StoredRun[]>()
  for (const r of all) bySnippet.set(r.snippetKey, [...(bySnippet.get(r.snippetKey) ?? []), r])
  for (const runs of bySnippet.values()) runs.sort(byBest).slice(0, BEST_LOGS_PER_SNIPPET).forEach((r) => keep.add(r.id))
  ;[...all].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, RECENT_LOGS).forEach((r) => keep.add(r.id))
  return keep
}

/** Opens local history, or resolves to null where the browser won't store it. */
export async function openHistory(factory?: IDBFactory | null): Promise<History | null> {
  try {
    // Even reading window.indexedDB can throw (blocked storage, sandboxed pages).
    const idb = factory === undefined ? globalThis.indexedDB : factory
    if (!idb) return null
    const open = idb.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = () => {
      const db = open.result
      const runs = db.createObjectStore('runs', { keyPath: 'id' })
      runs.createIndex('snippetKey', 'snippetKey')
      runs.createIndex('language', 'language')
      runs.createIndex('finishedAt', 'finishedAt')
      db.createObjectStore('logs')
    }
    const db = await request(open)
    return makeHistory(db)
  } catch {
    return null
  }
}

function makeHistory(db: IDBDatabase): History {
  return {
    async add(record) {
      const { log, ...rest } = record
      const run: StoredRun = { ...rest, snippetKey: snippetKey(record), hasLog: true }
      const tx = db.transaction(['runs', 'logs'], 'readwrite')
      const runs = tx.objectStore('runs')
      const logs = tx.objectStore('logs')
      runs.put(run)
      logs.put(log, run.id)

      // The logs to keep: this snippet's best 3, and the last 10 runs overall.
      const sameSnippet = (await request(runs.index('snippetKey').getAll(run.snippetKey))) as StoredRun[]
      const keep = new Set(sameSnippet.sort(byBest).slice(0, BEST_LOGS_PER_SNIPPET).map((r) => r.id))
      const recent: StoredRun[] = []
      let cursor = await request(runs.index('finishedAt').openCursor(null, 'prev'))
      // One past the last 10: the run that just stopped being recent.
      while (cursor && recent.length <= RECENT_LOGS) {
        recent.push(cursor.value as StoredRun)
        cursor.continue()
        cursor = await request(cursor.request as IDBRequest<IDBCursorWithValue | null>)
      }
      recent.slice(0, RECENT_LOGS).forEach((r) => keep.add(r.id))

      // Only runs whose status could have changed with this one need checking.
      const candidates = new Map([...sameSnippet, ...recent.slice(RECENT_LOGS)].map((r) => [r.id, r]))
      for (const r of candidates.values()) {
        if (!r.hasLog || keep.has(r.id)) continue
        // The other snippet's run that left the last 10 may still be among its own best 3.
        if (r.snippetKey !== run.snippetKey) {
          const theirs = (await request(runs.index('snippetKey').getAll(r.snippetKey))) as StoredRun[]
          if (theirs.sort(byBest).slice(0, BEST_LOGS_PER_SNIPPET).some((x) => x.id === r.id)) continue
        }
        logs.delete(r.id)
        runs.put({ ...r, hasLog: false })
      }
      await done(tx)
    },

    async setSubmission(id, submission) {
      const tx = db.transaction('runs', 'readwrite')
      const runs = tx.objectStore('runs')
      const run = (await request(runs.get(id))) as StoredRun | undefined
      if (run) runs.put({ ...run, submission })
      await done(tx)
    },

    async runs(filter = {}) {
      const store = db.transaction('runs').objectStore('runs')
      const all = (await request(
        filter.snippetKey
          ? store.index('snippetKey').getAll(filter.snippetKey)
          : filter.language
            ? store.index('language').getAll(filter.language)
            : store.getAll(),
      )) as StoredRun[]
      return all.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
    },

    async log(id) {
      return (await request(db.transaction('logs').objectStore('logs').get(id))) as LogEntry[] | undefined
    },

    async exportAll() {
      const tx = db.transaction(['runs', 'logs'])
      const runs = (await request(tx.objectStore('runs').getAll())) as StoredRun[]
      const ids = (await request(tx.objectStore('logs').getAllKeys())) as string[]
      const logs = (await request(tx.objectStore('logs').getAll())) as LogEntry[][]
      return {
        format: 'syntype-history',
        version: 1,
        exportedAt: new Date().toISOString(),
        runs: runs.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)),
        logs: ids.map((id, i) => ({ id, log: logs[i] })),
      }
    },

    async importAll(file) {
      const f = file as Partial<HistoryFile>
      if (!f || f.format !== 'syntype-history' || f.version !== 1 || !Array.isArray(f.runs)) {
        throw new Error('This is not a Syntype history file.')
      }
      const logs = new Map((Array.isArray(f.logs) ? f.logs : []).filter((l) => l && typeof l.id === 'string' && Array.isArray(l.log)).map((l) => [l.id, l.log]))
      const tx = db.transaction(['runs', 'logs'], 'readwrite')
      const runs = tx.objectStore('runs')
      const logStore = tx.objectStore('logs')
      const existing = new Set((await request(runs.getAllKeys())) as string[])
      let added = 0
      let skipped = 0
      for (const r of f.runs) {
        if (!validRun(r) || existing.has(r.id)) {
          skipped++
          continue
        }
        const log = logs.get(r.id)
        // A leaderboard status from the file is kept only if it reads as one.
        const sub = r.submission as Partial<Submission> | undefined
        const submission = sub && ['accepted', 'rejected', 'failed'].includes(sub.status as string) && typeof sub.at === 'string' ? (sub as Submission) : undefined
        runs.put({ ...r, snippetKey: snippetKey(r), hasLog: !!log, submission })
        if (log) logStore.put(log, r.id)
        added++
      }
      // The same log rules as for runs typed here.
      const all = (await request(runs.getAll())) as StoredRun[]
      const keep = logsToKeep(all)
      for (const r of all) {
        if (r.hasLog && !keep.has(r.id)) {
          logStore.delete(r.id)
          runs.put({ ...r, hasLog: false })
        }
      }
      await done(tx)
      return { added, skipped }
    },

    async clear(language) {
      const tx = db.transaction(['runs', 'logs'], 'readwrite')
      if (!language) {
        tx.objectStore('runs').clear()
        tx.objectStore('logs').clear()
      } else {
        const ids = (await request(tx.objectStore('runs').index('language').getAllKeys(language))) as string[]
        for (const id of ids) {
          tx.objectStore('runs').delete(id)
          tx.objectStore('logs').delete(id)
        }
      }
      await done(tx)
    },

    close: () => db.close(),
  }
}

/** How much this site stores on the device, and whether the browser has promised to keep it. */
export async function storageInfo(): Promise<{ bytes: number | null; persisted: boolean }> {
  try {
    const [estimate, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted()])
    return { bytes: estimate.usage ?? null, persisted }
  } catch {
    return { bytes: null, persisted: false }
  }
}

/**
 * Asks the browser to keep this site's data even when the disk fills up
 * (navigator.storage.persist()). Some browsers ask the player; some decide
 * themselves. Resolves to whether it's now kept.
 */
export async function keepSafe(): Promise<boolean> {
  try {
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
