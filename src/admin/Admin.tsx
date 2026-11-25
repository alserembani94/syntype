/**
 * The admin page (/admin, behind Cloudflare Access): the report queue, player
 * search and the action log. docs/leaderboard.md, "Moderation", has the rules.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  actionLog,
  actOnPlayer,
  closeReports,
  findPlayers,
  reportQueue,
  whoAmI,
  type AdminAction,
  type AdminPlayer,
  type PlayerAction,
  type Reason,
  type ReportGroup,
} from './api'

type Tab = 'reports' | 'players' | 'activity'
const TABS: { id: Tab; label: string }[] = [
  { id: 'reports', label: 'Reports' },
  { id: 'players', label: 'Players' },
  { id: 'activity', label: 'Activity' },
]

const REASONS: Record<Reason, string> = { cheating: 'Cheating', name: 'Offensive name', other: 'Other' }
const PROVIDERS = { github: 'GitHub', google: 'Google' }
const ACTIONS: Record<string, string> = {
  rename: 'Renamed',
  hide: 'Hid',
  show: 'Showed again',
  signout: 'Signed out everywhere',
  'resolve-reports': 'Resolved reports about',
  'dismiss-reports': 'Dismissed reports about',
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

export function Admin() {
  const [email, setEmail] = useState<string | null>(null)
  const [denied, setDenied] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    const hash = location.hash.slice(1)
    return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'reports'
  })
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    whoAmI().then(
      (me) => setEmail(me.email),
      (err) => setDenied(message(err)),
    )
  }, [])
  const show = (t: Tab) => {
    setTab(t)
    history.replaceState(null, '', `#${t}`)
  }

  return (
    <div className="wrap admin">
      <header className="top">
        <div className="brand">
          <h1>
            Syn<span>type</span>
          </h1>
          <span className="admin-badge">admin</span>
        </div>
        {email && (
          <nav className="tabs" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => show(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
        )}
        <div className="top-actions admin-who">
          {email && <span title="Signed in through Cloudflare Access">{email}</span>}
          <a className="btn" href="/">
            Back to Syntype
          </a>
        </div>
      </header>

      {denied ? (
        <p className="admin-empty problem" role="alert">
          {denied}
        </p>
      ) : !email ? (
        <p className="admin-empty">Checking access…</p>
      ) : tab === 'reports' ? (
        <Reports onNotice={setNotice} />
      ) : tab === 'players' ? (
        <Players onNotice={setNotice} />
      ) : (
        <Activity />
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

type Notify = (text: string) => void

function Reports({ onNotice }: { onNotice: Notify }) {
  const [status, setStatus] = useState<'open' | 'closed'>('open')
  const [groups, setGroups] = useState<ReportGroup[] | null>(null)
  const load = useCallback(() => {
    reportQueue(status).then(setGroups, (err) => onNotice(message(err)))
  }, [status, onNotice])
  useEffect(load, [load])

  const close = async (g: ReportGroup, how: 'resolved' | 'dismissed') => {
    if (!g.player) return
    try {
      const { closed } = await closeReports(g.player.id, g.run, how)
      onNotice(`${how === 'resolved' ? 'Resolved' : 'Dismissed'} ${closed} report${closed === 1 ? '' : 's'}.`)
      load()
    } catch (err) {
      onNotice(message(err))
    }
  }
  const updated = (p: AdminPlayer) => setGroups((gs) => gs?.map((g) => (g.player?.id === p.id ? { ...g, player: p } : g)) ?? null)

  return (
    <section className="admin-section" aria-label="Reports">
      <div className="admin-bar">
        <div className="segmented" role="group" aria-label="Which reports">
          {(['open', 'closed'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === 'open' ? 'Open' : 'Closed'}
            </button>
          ))}
        </div>
        <span className="admin-hint">{status === 'open' ? 'Most reported first.' : 'Most recent first.'}</span>
      </div>
      {groups === null ? (
        <p className="admin-empty">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="admin-empty">{status === 'open' ? 'No open reports. Nothing to do.' : 'No closed reports yet.'}</p>
      ) : (
        groups.map((g) => (
          <article key={`${g.player?.id}:${g.run}`} className="admin-card">
            <div className="admin-card-head">
              <div>
                {g.player ? <PlayerName player={g.player} /> : <strong>Deleted player</strong>}
                <div className="admin-meta">
                  {g.run ? `Run ${g.run.slice(0, 8)}` : 'The player'} · {g.count} report{g.count === 1 ? '' : 's'} · latest {when(g.latest)}
                </div>
              </div>
              {status === 'open' && g.player && (
                <div className="admin-actions">
                  <button type="button" className="btn accent" onClick={() => close(g, 'resolved')} title="Dealt with: you took action">
                    Resolve
                  </button>
                  <button type="button" className="btn" onClick={() => close(g, 'dismissed')} title="Nothing wrong">
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            <ul className="admin-reports">
              {g.reports.map((r) => (
                <li key={r.id}>
                  <span className={`reason reason-${r.reason}`}>{REASONS[r.reason]}</span>
                  {r.note ? <q>{r.note}</q> : <span className="admin-meta">No note</span>}
                  <span className="admin-meta">
                    {r.reporter ?? 'a deleted player'} · {when(r.createdAt)}
                    {status === 'closed' && ` · ${r.status}`}
                  </span>
                </li>
              ))}
            </ul>
            {g.player && <PlayerTools player={g.player} onChange={updated} onNotice={onNotice} />}
          </article>
        ))
      )}
    </section>
  )
}

function Players({ onNotice }: { onNotice: Notify }) {
  const [q, setQ] = useState('')
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null)
  useEffect(() => {
    let live = true
    const t = setTimeout(
      () =>
        findPlayers(q).then(
          (ps) => live && setPlayers(ps),
          (err) => onNotice(message(err)),
        ),
      q ? 250 : 0,
    )
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [q, onNotice])
  const updated = (p: AdminPlayer) => setPlayers((ps) => ps?.map((x) => (x.id === p.id ? p : x)) ?? null)

  return (
    <section className="admin-section" aria-label="Players">
      <div className="admin-bar">
        <label className="field admin-search">
          <span>Find a player</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, player ID or GitHub/Google ID" autoFocus spellCheck={false} />
        </label>
        <span className="admin-hint">{q ? '' : 'Newest players first.'}</span>
      </div>
      {players === null ? (
        <p className="admin-empty">Loading…</p>
      ) : players.length === 0 ? (
        <p className="admin-empty">No players match.</p>
      ) : (
        players.map((p) => (
          <article key={p.id} className="admin-card">
            <div className="admin-card-head">
              <div>
                <PlayerName player={p} />
                <div className="admin-meta">
                  {PROVIDERS[p.provider]} {p.providerId} · joined {day(p.createdAt)} · last seen {day(p.lastSeenAt)}
                  {p.openReports > 0 && ` · ${p.openReports} open report${p.openReports === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>
            <PlayerTools player={p} onChange={updated} onNotice={onNotice} />
          </article>
        ))
      )}
    </section>
  )
}

function PlayerName({ player }: { player: AdminPlayer }) {
  return (
    <span className="admin-name">
      <strong>{player.name ?? <em>No name yet</em>}</strong>
      {!player.name && <span className="admin-meta">suggested {player.suggestedName}</span>}
      {player.hiddenByModerator && <span className="tag tag-err">hidden by you</span>}
      {player.hidden && <span className="tag">hid themselves</span>}
    </span>
  )
}

/** Rename, hide or show, and sign out everywhere. */
function PlayerTools({ player, onChange, onNotice }: { player: AdminPlayer; onChange: (p: AdminPlayer) => void; onNotice: Notify }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (action: PlayerAction, body?: object, done?: string) => {
    setBusy(true)
    try {
      const p = await actOnPlayer(player.id, action, body)
      onChange(p)
      if (done) onNotice(done)
      return true
    } catch (err) {
      onNotice(message(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (renaming) {
    return (
      <form
        className="admin-tools"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await run('rename', { name }, `Renamed to ${name.trim()}. They can't change it for a week.`)) setRenaming(false)
        }}
      >
        <label className="field admin-rename">
          <span>New name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus spellCheck={false} />
        </label>
        <button type="submit" className="btn accent" disabled={busy || !name.trim()}>
          Rename
        </button>
        <button type="button" className="btn" onClick={() => setRenaming(false)}>
          Cancel
        </button>
      </form>
    )
  }
  return (
    <div className="admin-tools">
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => {
          setName(`Player ${1000 + Math.floor(Math.random() * 9000)}`)
          setRenaming(true)
        }}
      >
        Rename…
      </button>
      {player.hiddenByModerator ? (
        <button type="button" className="btn" disabled={busy} onClick={() => run('show', undefined, `${player.name ?? 'Player'} is back on the leaderboards.`)}>
          Show on leaderboards
        </button>
      ) : (
        <button type="button" className="btn danger" disabled={busy} onClick={() => run('hide', undefined, `${player.name ?? 'Player'} is hidden from the leaderboards.`)}>
          Hide from leaderboards
        </button>
      )}
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={() => confirm(`Sign ${player.name ?? 'this player'} out on every device?`) && run('signout', undefined, 'Signed out everywhere.')}
      >
        Sign out everywhere
      </button>
    </div>
  )
}

function Activity() {
  const [actions, setActions] = useState<AdminAction[] | null>(null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = (before?: string) =>
    actionLog(before).then(
      (page) => {
        setActions((a) => (before ? [...(a ?? []), ...page] : page))
        setMore(page.length === 50)
      },
      (err) => setError(message(err)),
    )
  useEffect(() => {
    load()
  }, [])

  if (error) return <p className="admin-empty problem">{error}</p>
  if (actions === null) return <p className="admin-empty">Loading…</p>
  if (actions.length === 0) return <p className="admin-empty">No actions yet. Everything you do here is recorded in this log.</p>
  return (
    <section className="admin-section" aria-label="Activity">
      <ol className="admin-log">
        {actions.map((a) => (
          <li key={a.id}>
            <time dateTime={a.createdAt}>{when(a.createdAt)}</time>
            <span>
              {ACTIONS[a.action] ?? a.action} <strong>{a.playerName ?? (a.player ? 'a deleted player' : '')}</strong>
              {a.run && ` (run ${a.run.slice(0, 8)})`}
              {a.action === 'rename' && a.detail && <RenameDetail detail={a.detail} />}
            </span>
            <span className="admin-meta">{a.admin}</span>
          </li>
        ))}
      </ol>
      {more && (
        <button type="button" className="btn" onClick={() => load(actions[actions.length - 1].createdAt)}>
          Older
        </button>
      )}
    </section>
  )
}

function RenameDetail({ detail }: { detail: string }) {
  let from: string | null | undefined
  try {
    from = (JSON.parse(detail) as { from: string | null }).from
  } catch {
    return null
  }
  return <span className="admin-meta"> (was {from ?? 'unnamed'})</span>
}
