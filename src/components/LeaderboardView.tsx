/**
 * The global leaderboards (docs/leaderboard.md, "Leaderboards"), at
 * /leaderboard: a language's snippets with each one's top score, one
 * snippet's board (top 15, by typing aids, with your own place), replays of
 * the kept runs, and reports. The data comes from /api/boards (worker/lib/boards.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Language, Snippet, SnippetLength } from '../languages'
import type { Player } from '../lib/account'
import { aidsKey, aidsOf, fetchBoard, fetchLanguageBoards, fetchMyPlace, fetchReplay, sendReport, type Board, type BoardReplay, type BoardRow, type LanguageBoards, type ReportReason } from '../lib/boards'
import { fingerprint } from '../lib/runlog'
import { whenPlayed } from '../lib/board'
import { ReplayView } from './ReplayView'
import { LanguagePicker } from './LanguagePicker'

const LENGTHS: SnippetLength[] = ['short', 'medium', 'long']

interface Place {
  language: string
  length: SnippetLength
  /** A snippet's board, by name; `version` picks an archived text. */
  snippet: string | null
  version: string | null
  aids: string
  replay: string | null
  /** Watching a replay as the admin (from the admin page). */
  admin: boolean
}

interface Props {
  languages: Language[]
  language: string
  length: SnippetLength
  /** The app's language and length, shared by every view; changing them here changes them everywhere. */
  onLanguage: (id: string) => void
  onLength: (l: SnippetLength) => void
  /** The signed-in player, for "You" and reports. */
  player: Player | null
  onType: (language: string, snippet: string) => void
  /** On the site: keep the board's place in the address (/leaderboard?lang=…), so Back and links work. */
  inAddress?: boolean
}

const placeFromAddress = (fallback: Place): Place => {
  const q = new URLSearchParams(location.search)
  const length = q.get('length')
  const aids = q.get('aids')
  return {
    language: q.get('lang') ?? fallback.language,
    length: length === 'short' || length === 'medium' || length === 'long' ? length : fallback.length,
    snippet: q.get('snippet'),
    version: q.get('v'),
    aids: aids && /^[01]{3}$/.test(aids) ? aids : 'any',
    replay: q.get('replay'),
    admin: q.get('admin') === '1',
  }
}

const addressOf = (p: Place) => {
  const q = new URLSearchParams({ lang: p.language, length: p.length })
  if (p.snippet) q.set('snippet', p.snippet)
  if (p.version) q.set('v', p.version)
  if (p.aids !== 'any') q.set('aids', p.aids)
  if (p.replay) q.set('replay', p.replay)
  if (p.admin) q.set('admin', '1')
  return `/leaderboard?${q}`
}

const AID_NAMES = ['auto-indent', 'auto-close', 'autocomplete']

export function LeaderboardView({ languages, language, length, onLanguage, onLength, player, onType, inAddress = true }: Props) {
  const fallback: Place = { language, length, snippet: null, version: null, aids: 'any', replay: null, admin: false }
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
    if (push) window.history.pushState(null, '', addressOf(next))
    else window.history.replaceState(null, '', addressOf(next))
  }
  const lang = languages.find((l) => l.id === place.language) ?? languages[0]

  if (place.replay) return <BoardReplayView languages={languages} runId={place.replay} admin={place.admin} onClose={() => go({ replay: null, admin: false }, true)} />
  if (place.snippet) {
    return (
      <SnippetBoard
        lang={lang}
        name={place.snippet}
        version={place.version}
        aids={place.aids}
        player={player}
        onAids={(aids) => go({ aids })}
        onBack={() => go({ snippet: null, version: null, aids: 'any' }, true)}
        onReplay={(id) => go({ replay: id }, true)}
        onType={() => onType(lang.id, place.snippet!)}
      />
    )
  }
  return (
    <LanguageOverview
      languages={languages}
      lang={lang}
      length={place.length}
      onLanguage={(l) => go({ language: l })}
      onLength={(l) => go({ length: l })}
      onOpen={(name, version) => go({ snippet: name, version }, true)}
    />
  )
}

function LanguageOverview({
  languages,
  lang,
  length,
  onLanguage,
  onLength,
  onOpen,
}: {
  languages: Language[]
  lang: Language
  length: SnippetLength
  onLanguage: (id: string) => void
  onLength: (l: SnippetLength) => void
  onOpen: (name: string, version: string | null) => void
}) {
  const [picking, setPicking] = useState(false)
  const [data, setData] = useState<{ language: string; boards: LanguageBoards } | { language: string; error: string } | null>(null)
  useEffect(() => {
    let live = true
    fetchLanguageBoards(lang.id).then(
      (boards) => live && setData({ language: lang.id, boards }),
      (err: Error) => live && setData({ language: lang.id, error: err.message }),
    )
    return () => {
      live = false
    }
  }, [lang])
  const loaded = data?.language === lang.id ? data : null
  const boards = loaded && 'boards' in loaded ? loaded.boards : null
  const byName = new Map(boards?.snippets.map((s) => [s.name, s]))
  const snippets = lang.snippets.filter((s) => s.length === length)
  const archived = boards?.archived.filter((a) => a.length === length) ?? []

  return (
    <section className="runs boards" aria-labelledby="boards-title">
      <div className="runs-head">
        <h2 id="boards-title">Leaderboards</h2>
        <p className="runs-muted">Each snippet has its own board: signed-in players’ best runs, at least 75% accurate, checked by replaying their keystrokes.</p>
      </div>
      {/* The game's own language button and picker (search, sections), so the list can keep growing. */}
      <div className="settings boards-settings">
        <button type="button" className="lang-button" onClick={() => setPicking(true)} aria-haspopup="dialog" title="Change language">
          <span className="lang-icon" aria-hidden="true">
            {'</>'}
          </span>
          {lang.name}
        </button>
        <div className="seg" role="group" aria-label="Length">
          {LENGTHS.map((l) => (
            <button key={l} type="button" className="chip" aria-pressed={l === length} onClick={() => onLength(l)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {picking && (
        <LanguagePicker
          languages={languages}
          currentId={lang.id}
          onSelect={(id) => {
            setPicking(false)
            onLanguage(id)
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {loaded && 'error' in loaded ? (
        <p className="runs-note problem">{loaded.error}</p>
      ) : (
        <div className="pane runs-table-wrap" aria-busy={!boards}>
          <table className="runs-table">
            <thead>
              <tr>
                <th>Snippet</th>
                <th>Top WPM</th>
                <th>Held by</th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {snippets.map((s) => {
                const top = byName.get(s.name)?.top
                return (
                  <tr key={s.name} className="clickable" onClick={() => onOpen(s.name, null)}>
                    <td className="name">{s.name}</td>
                    <td className={top ? 'best' : ''}>{top ? Math.round(top.wpm) : boards ? '–' : ''}</td>
                    <td>{top ? top.name : boards ? <span className="runs-muted">no runs yet</span> : ''}</td>
                    <td>
                      <button
                        type="button"
                        className="link"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpen(s.name, null)
                        }}
                      >
                        board ›
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {archived.length > 0 && (
        <div className="archived">
          <h3>Older versions</h3>
          <p className="runs-muted">These snippets have since changed, so their boards are closed. Their runs and replays stay.</p>
          <ul>
            {archived.map((a) => (
              <li key={a.fingerprint}>
                <button type="button" className="link" onClick={() => onOpen(a.name, a.fingerprint)}>
                  {a.name}
                </button>{' '}
                <span className="runs-muted">first played {whenPlayed(a.since)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function SnippetBoard({
  lang,
  name,
  version,
  aids,
  player,
  onAids,
  onBack,
  onReplay,
  onType,
}: {
  lang: Language
  name: string
  version: string | null
  aids: string
  player: Player | null
  onAids: (aids: string) => void
  onBack: () => void
  onReplay: (runId: string) => void
  onType: () => void
}) {
  const snippet = lang.snippets.find((s) => s.name === name)
  // The board's fingerprint: the snippet's current text, or an archived version's.
  const [current, setCurrent] = useState<{ code: string; fp: string } | null>(null)
  useEffect(() => {
    let live = true
    if (snippet && !version) fingerprint(snippet.code).then((fp) => live && setCurrent({ code: snippet.code, fp }))
    return () => {
      live = false
    }
  }, [snippet, version])
  const fp = version ?? (current && current.code === snippet?.code ? current.fp : null)

  const [loaded, setLoaded] = useState<{ key: string; board: Board | null; mine: BoardRow | null; error?: string } | null>(null)
  const key = `${fp}/${aids}`
  useEffect(() => {
    if (!fp) return
    let live = true
    Promise.all([fetchBoard(fp, aids), player?.name ? fetchMyPlace(fp, aids).catch(() => null) : Promise.resolve(null)]).then(
      ([board, mine]) => live && setLoaded({ key: `${fp}/${aids}`, board, mine }),
      (err: Error) => live && setLoaded({ key: `${fp}/${aids}`, board: null, mine: null, error: err.message }),
    )
    return () => {
      live = false
    }
  }, [fp, aids, player])
  const data = loaded?.key === key ? loaded : null
  const [reporting, setReporting] = useState<BoardRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!snippet && !version) {
    return (
      <section className="runs">
        <p className="runs-note">There’s no snippet called {name} in {lang.name}.</p>
        <button type="button" className="btn" onClick={onBack}>
          ‹ {lang.name} boards
        </button>
      </section>
    )
  }
  const board = data?.board
  const archived = board ? !board.snippet.current : !!version
  const mine = data?.mine
  const inTop = mine && board?.rows.some((r) => r.player.id === mine.player.id)
  const custom = aids !== 'any' ? aidsOf(aids) : null

  return (
    <section className="runs boards" aria-labelledby="board-title">
      <div className="runs-head">
        <nav className="crumbs" aria-label="Breadcrumb">
          <button type="button" className="link" onClick={onBack}>
            Leaderboards › {lang.name}
          </button>{' '}
          › <b id="board-title">{name}</b>
          {archived && <span className="tag-archived">older version</span>}
        </nav>
        {!archived && snippet && (
          <button type="button" className="btn accent" onClick={onType}>
            Type this snippet
          </button>
        )}
      </div>

      <div className="aids-filter" role="group" aria-label="Typing aids">
        <span className="label">typing aids</span>
        <div className="seg">
          <button type="button" className="chip" aria-pressed={aids === 'any'} onClick={() => onAids('any')}>
            any
          </button>
          <button type="button" className="chip" aria-pressed={!!custom} onClick={() => onAids(custom ? aids : '110')}>
            exactly
          </button>
        </div>
        {custom && (
          <div className="seg">
            {(['autoIndent', 'autoClose', 'autocomplete'] as const).map((k, i) => (
              <button key={k} type="button" className="chip" aria-pressed={custom[k]} onClick={() => onAids(aidsKey({ ...custom, [k]: !custom[k] }))}>
                {AID_NAMES[i]}
              </button>
            ))}
          </div>
        )}
      </div>

      {data?.error ? (
        <p className="runs-note problem">{data.error}</p>
      ) : (
        <div className="pane runs-table-wrap" aria-busy={!data}>
          {data && board && board.rows.length === 0 ? (
            <p className="runs-note">{aids === 'any' ? 'No runs on this board yet. Sign in and type it to be the first.' : 'No runs with exactly these typing aids yet.'}</p>
          ) : (
            <table className="runs-table board-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Player</th>
                  <th>WPM</th>
                  <th>Accuracy</th>
                  <th className="wide">Typing aids</th>
                  <th className="wide">When</th>
                  <th>Replay</th>
                  <th aria-label="Report" />
                </tr>
              </thead>
              <tbody>
                {board?.rows.map((r) => (
                  <Row key={r.runId} row={r} mine={r.player.id === player?.id} canReport={!!player?.name && r.player.id !== player.id} onReplay={onReplay} onReport={setReporting} />
                ))}
                {mine && !inTop && (
                  <>
                    {/* How far down "you" are: the players between the top 15 and you. */}
                    <tr className="gap">
                      <td colSpan={8}>
                        {mine.rank - (board?.rows.length ?? 0) > 1
                          ? `⋯ ${mine.rank - (board?.rows.length ?? 0) - 1} more ${mine.rank - (board?.rows.length ?? 0) - 1 === 1 ? 'player' : 'players'} ⋯`
                          : '⋯'}
                      </td>
                    </tr>
                    <Row row={mine} mine canReport={false} onReplay={onReplay} onReport={setReporting} />
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
      {!player && <p className="runs-muted">Sign in to put your own runs on the boards.</p>}
      {reporting && (
        <ReportDialog
          row={reporting}
          onClose={() => setReporting(null)}
          onSent={() => {
            setReporting(null)
            setNotice('Thanks. The report was sent to the moderator.')
          }}
        />
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}
    </section>
  )
}

function Row({ row: r, mine, canReport, onReplay, onReport }: { row: BoardRow; mine: boolean; canReport: boolean; onReplay: (id: string) => void; onReport: (r: BoardRow) => void }) {
  const a = aidsOf(r.aids)
  return (
    <tr className={mine ? 'mine' : undefined}>
      <td className="rank">{r.rank}</td>
      <td className="name">
        {r.player.name}
        {mine && <span className="best-mark">you</span>}
      </td>
      <td className="best">{Math.round(r.wpm)}</td>
      <td className="stat">{Math.round(r.accuracy)}%</td>
      <td className="wide">
        <span className="aid-tags">
          <i className={a.autoIndent ? '' : 'off'} title="auto-indent">indent</i>
          <i className={a.autoClose ? '' : 'off'} title="auto-close">close</i>
          <i className={a.autocomplete ? '' : 'off'} title="autocomplete">auto</i>
        </span>
      </td>
      <td className="wide">{whenPlayed(r.finishedAt)}</td>
      <td>
        {r.hasLog ? (
          <button type="button" className="link play" onClick={() => onReplay(r.runId)}>
            ▶ replay
          </button>
        ) : (
          <span className="runs-muted" title="Replays are kept for each board’s top 20">
            –
          </span>
        )}
      </td>
      <td>
        {canReport && (
          <button type="button" className="icon-link" aria-label={`Report ${r.player.name}’s run`} title="Report" onClick={() => onReport(r)}>
            ⚑
          </button>
        )}
      </td>
    </tr>
  )
}

const REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: 'cheating', label: 'Cheating', hint: 'The run looks automated or faked.' },
  { id: 'name', label: 'Offensive name', hint: 'The player’s name is abusive or inappropriate.' },
  { id: 'other', label: 'Something else', hint: 'Tell the moderator in the note.' },
]

function ReportDialog({ row, onClose, onSent }: { row: BoardRow; onClose: () => void; onSent: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Report"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        onSubmit={async (e) => {
          e.preventDefault()
          if (!reason || sending) return
          setSending(true)
          const problem = await sendReport({ player: row.player.id, run: reason === 'name' ? undefined : row.runId, reason, note })
          setSending(false)
          if (problem) setError(problem)
          else onSent()
        }}
      >
        <h2>Report {row.player.name}</h2>
        <p className="dialog-text">The moderator looks at every report. Reports are private: the player isn’t told who sent one.</p>
        <fieldset className="reasons">
          <legend className="dialog-note">What’s wrong?</legend>
          {REASONS.map((r) => (
            <label key={r.id} className="reason-option">
              <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
              <span>
                <b>{r.label}</b>
                <span className="dialog-note">{r.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span>Note (optional)</span>
          <textarea value={note} maxLength={500} rows={3} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && (
          <p className="dialog-note problem" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn accent" disabled={!reason || sending}>
            {sending ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </form>
    </div>
  )
}

function BoardReplayView({ languages, runId, admin, onClose }: { languages: Language[]; runId: string; admin: boolean; onClose: () => void }) {
  const [data, setData] = useState<{ id: string; replay: BoardReplay } | { id: string; error: string } | null>(null)
  useEffect(() => {
    let live = true
    fetchReplay(runId, admin).then(
      (replay) => live && setData({ id: runId, replay }),
      (err: Error) => live && setData({ id: runId, error: err.message }),
    )
    return () => {
      live = false
    }
  }, [runId, admin])
  const loaded = data?.id === runId ? data : null
  const replay = loaded && 'replay' in loaded ? loaded.replay : null
  // Stable objects for the replay, so it loads once.
  const parts = useMemo(() => {
    if (!replay) return null
    const lang = languages.find((l) => l.id === replay.snippet.language)
    if (!lang) return null
    const snippet: Snippet = { name: replay.snippet.name, code: replay.snippet.code, length: replay.snippet.length }
    return { lang, snippet, run: { wpm: replay.wpm, accuracy: replay.accuracy, finishedAt: replay.finishedAt, aids: aidsOf(replay.aids) } }
  }, [replay, languages])

  if (loaded && 'error' in loaded) {
    return (
      <section className="runs">
        <p className="runs-note problem">{loaded.error}</p>
        <button type="button" className="btn" onClick={onClose}>
          ‹ Back
        </button>
      </section>
    )
  }
  if (!replay || !parts) return <section className="runs" aria-busy="true" />
  return (
    <ReplayView
      lang={parts.lang}
      snippet={parts.snippet}
      run={parts.run}
      loadLog={() => Promise.resolve(replay.log)}
      crumbs={['Leaderboards', parts.lang.name, parts.snippet.name]}
      by={replay.player.name}
      onClose={onClose}
    />
  )
}
