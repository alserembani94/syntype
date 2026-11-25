import { useEffect, useMemo, useRef, useState } from 'react'
import { AidTags } from './AidTags'
import type { Language, SnippetLength } from '../languages'
import { keepSafe, snippetKey, storageInfo, type History, type StoredRun } from '../lib/history'
import { fingerprint } from '../lib/runlog'
import {
  duration,
  matchesAids,
  overview,
  runTime,
  snippetStats,
  whenPlayed,
  type AidsFilter,
} from '../lib/board'
import { ReplayView } from './ReplayView'

const LENGTHS: SnippetLength[] = ['short', 'medium', 'long']

interface Place {
  language: string
  length: SnippetLength
  snippet: string | null
  replay: string | null
}

interface Props {
  languages: Language[]
  history: Promise<History | null>
  /** The app's language and length, shared by every view; changing them here changes them everywhere. */
  language: string
  length: SnippetLength
  onLanguage: (id: string) => void
  onLength: (l: SnippetLength) => void
  /** On the site itself: keep the board's place in the address (/runs?lang=…). */
  inAddress: boolean
  /** "Type this snippet": switch to the game with it loaded. */
  onType: (language: string, snippet: string) => void
}

const placeFromAddress = (fallback: Place): Place => {
  const q = new URLSearchParams(location.search)
  const length = q.get('length')
  return {
    language: q.get('lang') ?? fallback.language,
    length: length === 'short' || length === 'medium' || length === 'long' ? length : fallback.length,
    snippet: q.get('snippet'),
    replay: q.get('replay'),
  }
}

const addressOf = (p: Place) => {
  const q = new URLSearchParams({ lang: p.language, length: p.length })
  if (p.snippet) q.set('snippet', p.snippet)
  if (p.replay) q.set('replay', p.replay)
  return `/runs?${q}`
}

/** The personal board: every run kept on this device (docs/leaderboard.md). */
export function RunsView({ languages, history, language, length, onLanguage, onLength, inAddress, onType }: Props) {
  const fallback: Place = { language, length, snippet: null, replay: null }
  const [own, setPlace] = useState<Place>(() => (inAddress ? placeFromAddress(fallback) : fallback))
  // The language and length are the app's; the rest is this view's own.
  const place: Place = { ...own, language, length }
  const fallbackRef = useRef(fallback)
  const onLanguageRef = useRef(onLanguage)
  const onLengthRef = useRef(onLength)
  useEffect(() => {
    fallbackRef.current = fallback
    onLanguageRef.current = onLanguage
    onLengthRef.current = onLength
  })
  const [runs, setRuns] = useState<StoredRun[] | null>(null)
  const [store, setStore] = useState<History | null | undefined>(undefined)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    history.then(async (h) => {
      if (!live) return
      setStore(h)
      setRuns(h ? await h.runs() : [])
    })
    return () => {
      live = false
    }
  }, [history, reload])

  // The back button steps out of a snippet or a replay.
  useEffect(() => {
    if (!inAddress) return
    const onPop = () => {
      const next = placeFromAddress(fallbackRef.current)
      setPlace(next)
      if (next.language !== fallbackRef.current.language) onLanguageRef.current(next.language)
      if (next.length !== fallbackRef.current.length) onLengthRef.current(next.length)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [inAddress])

  const go = (changes: Partial<Place>, push = false) => {
    const next = { ...place, ...changes }
    setPlace(next)
    if (next.language !== language) onLanguage(next.language)
    if (next.length !== length) onLength(next.length)
    if (!inAddress) return
    if (push) history_.push(addressOf(next))
    else history_.replace(addressOf(next))
  }

  const lang = languages.find((l) => l.id === place.language) ?? languages[0]

  // Runs only count for a snippet's current text: an edited snippet starts afresh, as on the leaderboard.
  const [prints, setPrints] = useState<Record<string, string>>({})
  useEffect(() => {
    let live = true
    Promise.all(lang.snippets.map(async (s) => [s.name, await fingerprint(s.code)] as const)).then(
      (pairs) => live && setPrints(Object.fromEntries(pairs)),
    )
    return () => {
      live = false
    }
  }, [lang])

  if (store === null) {
    return (
      <section className="runs">
        <h2>My runs</h2>
        <p className="runs-note">
          This browser isn't letting Syntype save runs on this device (a private window, or storage turned off), so
          there's nothing to show. Typing still works as usual.
        </p>
      </section>
    )
  }
  if (!runs || store === undefined) return <section className="runs" aria-busy="true" />

  const snippetRuns = (name: string) => {
    const key = prints[name] && snippetKey({ language: lang.id, snippet: name, fingerprint: prints[name] })
    return runs.filter((r) => r.snippetKey === key)
  }

  if (place.snippet && place.replay) {
    const snippet = lang.snippets.find((s) => s.name === place.snippet)
    const run = runs.find((r) => r.id === place.replay)
    if (snippet && run && prints[snippet.name] === run.fingerprint) {
      return (
        <ReplayView
          lang={lang}
          snippet={snippet}
          run={run}
          loadLog={() => store.log(run.id)}
          crumbs={['My runs', lang.name, place.length, snippet.name]}
          onClose={() => go({ replay: null }, true)}
        />
      )
    }
  }

  if (place.snippet) {
    const snippet = lang.snippets.find((s) => s.name === place.snippet)
    if (snippet) {
      return (
        <SnippetRuns
          lang={lang}
          name={snippet.name}
          length={snippet.length}
          runs={snippetRuns(snippet.name)}
          onBack={() => go({ snippet: null }, true)}
          onType={() => onType(lang.id, snippet.name)}
          onReplay={(id) => go({ replay: id }, true)}
        />
      )
    }
  }

  return (
    <Overview
      languages={languages}
      lang={lang}
      length={place.length}
      runs={runs}
      snippetRuns={snippetRuns}
      store={store}
      onLanguage={(l) => go({ language: l })}
      onLength={(l) => go({ length: l })}
      onOpen={(name) => go({ snippet: name }, true)}
      onType={(name) => onType(lang.id, name)}
      onChanged={() => setReload((n) => n + 1)}
    />
  )
}

/** The page's address, separate from the run history above. */
const history_ = {
  push: (url: string) => window.history.pushState(null, '', url),
  replace: (url: string) => window.history.replaceState(null, '', url),
}

function AidsChips({ value, onChange }: { value: AidsFilter; onChange: (f: AidsFilter) => void }) {
  const custom = typeof value === 'object' ? value : null
  const toggle = (k: 'autoIndent' | 'autoClose' | 'autocomplete') => custom && onChange({ ...custom, [k]: !custom[k] })
  return (
    <div className="aids-filter" role="group" aria-label="Typing aids">
      <span className="label">typing aids</span>
      <div className="seg">
        {(['any', 'on', 'off'] as const).map((f) => (
          <button key={f} type="button" className="chip" aria-pressed={value === f} onClick={() => onChange(f)}>
            {f === 'any' ? 'any' : f === 'on' ? 'all on' : 'all off'}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          aria-pressed={!!custom}
          onClick={() => onChange(custom ?? { autoIndent: true, autoClose: true, autocomplete: false })}
        >
          custom
        </button>
      </div>
      {custom && (
        <div className="seg">
          <button type="button" className="chip" aria-pressed={custom.autoIndent} onClick={() => toggle('autoIndent')}>
            auto-indent
          </button>
          <button type="button" className="chip" aria-pressed={custom.autoClose} onClick={() => toggle('autoClose')}>
            auto-close
          </button>
          <button type="button" className="chip" aria-pressed={custom.autocomplete} onClick={() => toggle('autocomplete')}>
            autocomplete
          </button>
        </div>
      )}
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="runs-muted">{values.length ? 'one run' : ''}</span>
  const w = 90
  const h = 22
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const y = (v: number) => (hi === lo ? h / 2 : h - 3 - ((v - lo) / (hi - lo)) * (h - 6))
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={`last ${values.length} runs: ${values.map(Math.round).join(', ')} wpm`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

interface OverviewProps {
  languages: Language[]
  lang: Language
  length: SnippetLength
  runs: StoredRun[]
  snippetRuns: (name: string) => StoredRun[]
  store: History
  onLanguage: (id: string) => void
  onLength: (l: SnippetLength) => void
  onOpen: (snippet: string) => void
  onType: (snippet: string) => void
  onChanged: () => void
}

function Overview({ languages, lang, length, runs, snippetRuns, store, onLanguage, onLength, onOpen, onType, onChanged }: OverviewProps) {
  const [aids, setAids] = useState<AidsFilter>('any')
  const [showAll, setShowAll] = useState(false)
  const o = overview(runs, length)
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const r of runs) c.set(r.language, (c.get(r.language) ?? 0) + 1)
    return c
  }, [runs])
  const played = languages.filter((l) => counts.has(l.id)).sort((a, b) => counts.get(b.id)! - counts.get(a.id)!)
  const unplayed = languages.filter((l) => !counts.has(l.id))
  const shown = showAll ? [...played, ...unplayed] : played.includes(lang) ? played : [...played, lang]
  const since = runs.length ? runs.reduce((a, r) => (r.finishedAt < a ? r.finishedAt : a), runs[0].finishedAt) : null
  const bestLang = o.best && languages.find((l) => l.id === o.best!.language)
  const change = o.last10 !== null && o.previous10 !== null ? o.last10 - o.previous10 : null

  const rows = lang.snippets
    .filter((s) => s.length === length)
    .map((s) => ({ name: s.name, stats: snippetStats(snippetRuns(s.name).filter((r) => matchesAids(aids, r.aids))) }))
    .sort((a, b) => (b.stats?.best?.wpm ?? -1) - (a.stats?.best?.wpm ?? -1) || (b.stats ? 1 : 0) - (a.stats ? 1 : 0) || a.name.localeCompare(b.name))

  return (
    <section className="runs" aria-labelledby="runs-title">
      <div>
        <h2 id="runs-title">My runs</h2>
        <p className="runs-sub">
          Saved in this browser only.
          {since && ` ${runs.length} ${runs.length === 1 ? 'run' : 'runs'} since ${new Date(since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.`}
        </p>
      </div>

      {runs.length === 0 ? (
        <p className="runs-note">
          No runs yet. Every snippet you finish is saved here, with its speed, accuracy and a replay. <button type="button" className="link" onClick={() => onType(lang.snippets.find((s) => s.length === length)!.name)}>Start typing</button>
        </p>
      ) : (
        <div className="cards">
          <div className="card">
            <span className="k">runs</span>
            <span className="v">{o.runs}</span>
            <span className="s">across {o.languages} {o.languages === 1 ? 'language' : 'languages'}</span>
          </div>
          <div className="card">
            <span className="k">time typing</span>
            <span className="v">{duration(o.seconds)}</span>
            <span className="s">pauses not counted</span>
          </div>
          <div className="card">
            <span className="k">best ({length})</span>
            <span className="v">{o.best ? `${Math.round(o.best.wpm)} wpm` : '–'}</span>
            <span className="s">{o.best ? `${o.best.snippet} · ${bestLang?.name ?? o.best.language}` : `no accurate ${length} run yet`}</span>
          </div>
          <div className="card">
            <span className="k">last 10 runs</span>
            <span className="v">{o.last10 !== null ? `${Math.round(o.last10)} wpm` : '–'}</span>
            <span className="s">
              {change === null ? 'compared once you have 20 runs' : `${change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(change))} from the 10 before`}
            </span>
          </div>
        </div>
      )}

      <div className="lang-chips" role="group" aria-label="Language">
        {shown.map((l) => (
          <button key={l.id} type="button" className="lang-chip" aria-pressed={l.id === lang.id} onClick={() => onLanguage(l.id)}>
            {l.name}
            {counts.has(l.id) && <small>{counts.get(l.id)}</small>}
          </button>
        ))}
        {!showAll && unplayed.length > (played.includes(lang) ? 0 : 1) && (
          <button type="button" className="lang-chip more" onClick={() => setShowAll(true)}>
            + {unplayed.length - (played.includes(lang) ? 0 : 1)} not played
          </button>
        )}
      </div>

      <div className="runs-filters">
        <div className="seg" role="group" aria-label="Length">
          {LENGTHS.map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={l === length} onClick={() => onLength(l)}>
              {l}
            </button>
          ))}
        </div>
        <AidsChips value={aids} onChange={setAids} />
      </div>

      <div className="pane runs-table-wrap">
        <table className="runs-table">
          <thead>
            <tr>
              <th>Snippet</th>
              <th>Best</th>
              <th>Average</th>
              <th>Accuracy</th>
              <th>Runs</th>
              <th className="wide">Trend</th>
              <th className="wide">Last played</th>
              <th aria-label="Action" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, stats }) =>
              stats ? (
                <tr key={name} className="clickable" onClick={() => onOpen(name)}>
                  <td className="name">{name}</td>
                  <td className="best">{stats.best ? Math.round(stats.best.wpm) : '–'}</td>
                  <td className="stat">{Math.round(stats.averageWpm)}</td>
                  <td className="stat">{Math.round(stats.averageAccuracy)}%</td>
                  <td className="stat">{stats.runs}</td>
                  <td className="wide trend">
                    <Sparkline values={stats.trend} />
                  </td>
                  <td className="wide">{whenPlayed(stats.lastPlayed)}</td>
                  <td>
                    <button type="button" className="link" onClick={(e) => (e.stopPropagation(), onOpen(name))}>
                      open ›
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={name} className="unplayed">
                  <td className="name">{name}</td>
                  <td>–</td>
                  <td>–</td>
                  <td>–</td>
                  <td>0</td>
                  <td className="wide" />
                  <td className="wide">{aids === 'any' ? 'not played yet' : 'none with these aids'}</td>
                  <td>
                    <button type="button" className="link" onClick={() => onType(name)}>
                      type it ›
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <StorageRow store={store} language={lang} onChanged={onChanged} />
    </section>
  )
}

function StorageRow({ store, language, onChanged }: { store: History; language: Language; onChanged: () => void }) {
  const [info, setInfo] = useState<{ bytes: number | null; persisted: boolean } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    storageInfo().then(setInfo)
  }, [])

  const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

  const exportFile = async () => {
    const data = await store.exportAll()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `syntype-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage(`Exported ${data.runs.length} runs.`)
  }

  const importFile = async (file: File) => {
    try {
      const { added, skipped } = await store.importAll(JSON.parse(await file.text()))
      setMessage(`Imported ${added} ${added === 1 ? 'run' : 'runs'}${skipped ? `; ${skipped} already here or unreadable` : ''}.`)
      onChanged()
    } catch (err) {
      setMessage(err instanceof SyntaxError ? 'That file isn’t a Syntype history file.' : (err as Error).message)
    }
  }

  const clear = async (lang?: string) => {
    await store.clear(lang)
    setConfirming(false)
    setMessage(lang ? `Cleared your ${language.name} runs.` : 'Cleared all runs on this device.')
    onChanged()
  }

  return (
    <div className="runs-storage">
      <span>
        Saved in this browser{info?.bytes != null && ` · ${size(info.bytes)}`}
        {info?.persisted && ' · kept safe ✓'}
      </span>
      {info && !info.persisted && (
        <button
          type="button"
          className="btn accent"
          title="Ask the browser not to delete this site's data when the disk fills up"
          onClick={async () => {
            const kept = await keepSafe()
            setInfo({ ...info, persisted: kept })
            setMessage(kept ? 'Your browser will keep your history.' : 'Your browser didn’t agree this time. Export a copy to be sure.')
          }}
        >
          Keep my history safe
        </button>
      )}
      <button type="button" className="btn" onClick={exportFile}>
        Export
      </button>
      <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importFile(f)
          e.target.value = ''
        }}
      />
      {confirming ? (
        <span className="confirm" role="group" aria-label="Clear history">
          Clear
          <button type="button" className="btn danger" onClick={() => clear(language.id)}>
            {language.name} runs
          </button>
          <button type="button" className="btn danger" onClick={() => clear()}>
            everything
          </button>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
          Clear…
        </button>
      )}
      {message && (
        <span className="runs-message" role="status">
          {message}
        </span>
      )}
    </div>
  )
}

interface SnippetRunsProps {
  lang: Language
  name: string
  length: SnippetLength
  runs: StoredRun[]
  onBack: () => void
  onType: () => void
  onReplay: (id: string) => void
}

function SnippetRuns({ lang, name, length, runs, onBack, onType, onReplay }: SnippetRunsProps) {
  const [aids, setAids] = useState<AidsFilter>('any')
  const shown = runs.filter((r) => matchesAids(aids, r.aids))
  const stats = snippetStats(shown)
  const newestFirst = [...shown].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
  const anySubmitted = newestFirst.some((r) => r.submission)
  return (
    <section className="runs" aria-labelledby="snippet-title">
      <div className="runs-head">
        <div>
          <nav className="crumbs" aria-label="Breadcrumb">
            <button type="button" className="link" onClick={onBack}>
              My runs
            </button>{' '}
            › {lang.name} › {length} › <b>{name}</b>
          </nav>
          <h2 id="snippet-title">{name}</h2>
        </div>
        <button type="button" className="btn accent" onClick={onType}>
          Type this snippet
        </button>
      </div>

      {stats ? (
        <div className="runs-detail">
          <div className="pane runs-chart">
            <span className="k">WPM per run · best so far highlighted</span>
            <RunsChart runs={[...shown].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))} best={stats.best} />
          </div>
          <div className="pane runs-summary">
            <div>
              <span className="k">best</span>
              <span className="v">{stats.best ? `${Math.round(stats.best.wpm)} wpm` : '–'}</span>
              <span className="s">{stats.best ? `${Math.round(stats.best.accuracy)}% accuracy · ${whenPlayed(stats.best.finishedAt)}` : 'no run accurate enough yet'}</span>
            </div>
            <div>
              <span className="k">average of {stats.runs}</span>
              <span className="v plain">{Math.round(stats.averageWpm)} wpm</span>
              <span className="s">{stats.averageAccuracy.toFixed(1)}% accuracy</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="runs-note">{runs.length ? 'No runs with these typing aids.' : 'You haven’t typed this snippet yet.'}</p>
      )}

      {runs.length > 0 && (
        <div className="runs-filters">
          <AidsChips value={aids} onChange={setAids} />
        </div>
      )}

      {newestFirst.length > 0 && (
        <div className="pane runs-table-wrap">
          <table className="runs-table">
            <thead>
              <tr>
                <th>When</th>
                <th>WPM</th>
                <th>Raw</th>
                <th>Accuracy</th>
                <th>Time</th>
                <th className="wide">Typing aids</th>
                {anySubmitted && <th>Leaderboard</th>}
                <th>Replay</th>
              </tr>
            </thead>
            <tbody>
              {newestFirst.map((r) => (
                <tr key={r.id}>
                  <td>{runTime(r.finishedAt)}</td>
                  <td className={r.id === stats?.best?.id ? 'best' : 'stat'}>
                    {Math.round(r.wpm)}
                    {r.id === stats?.best?.id && <span className="best-mark">best</span>}
                  </td>
                  <td className="stat">{Math.round(r.rawWpm)}</td>
                  <td className="stat">{Math.round(r.accuracy)}%</td>
                  <td className="stat">{duration(r.seconds)}</td>
                  <td className="wide">
                    <AidTags aids={r.aids} />
                  </td>
                  {anySubmitted && <td>{boardCell(r)}</td>}
                  <td>
                    {r.hasLog ? (
                      <button type="button" className="link play" onClick={() => onReplay(r.id)}>
                        ▶ replay
                      </button>
                    ) : (
                      <span className="runs-muted" title="Logs are kept for each snippet's best 3 runs and your last 10">
                        log not kept
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RunsChart({ runs, best }: { runs: StoredRun[]; best: StoredRun | null }) {
  const w = 520
  const h = 170
  const pad = { l: 34, r: 12, t: 12, b: 22 }
  const values = runs.map((r) => r.wpm)
  const lo = Math.floor(Math.min(...values) / 10) * 10
  const hi = Math.max(lo + 10, Math.ceil(Math.max(...values) / 10) * 10)
  const x = (i: number) => pad.l + (runs.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (runs.length - 1)) * (w - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b)
  const ticks = [lo, Math.round((lo + hi) / 2), hi]
  return (
    <svg className="chart runs-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${runs.length} runs from ${Math.round(Math.min(...values))} to ${Math.round(Math.max(...values))} wpm`}>
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid" x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} />
          <text className="axis" x={pad.l - 6} y={y(t) + 3} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {runs.length > 1 && <polyline className="runs-line" points={runs.map((r, i) => `${x(i)},${y(r.wpm)}`).join(' ')} />}
      {runs.map((r, i) => (
        <circle key={r.id} className={r.id === best?.id ? 'runs-dot best' : 'runs-dot'} cx={x(i)} cy={y(r.wpm)} r={r.id === best?.id ? 5 : 3.5}>
          <title>{`${runTime(r.finishedAt)}: ${Math.round(r.wpm)} wpm, ${Math.round(r.accuracy)}%`}</title>
        </circle>
      ))}
    </svg>
  )
}

/** What happened to a run on the leaderboard, for its row in the run list. */
function boardCell(r: StoredRun) {
  const sub = r.submission
  if (!sub) return <span className="runs-muted">–</span>
  switch (sub.status) {
    case 'accepted':
      return (
        <span className="stat" title={sub.best ? 'A new best on the leaderboard when it was sent' : 'Accepted; an earlier run was your best'}>
          {sub.best ? `#${sub.rank}` : 'accepted'}
        </span>
      )
    case 'rejected':
      return (
        <span className="runs-problem" title={sub.message}>
          rejected
        </span>
      )
    case 'failed':
      return (
        <span className="runs-muted" title={sub.message}>
          not sent
        </span>
      )
  }
}
