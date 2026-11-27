/**
 * The admin page (/admin, behind Cloudflare Access): the report queue, player
 * search and the action log. docs/leaderboard.md, "Moderation", has the rules.
 */
import { date, dateTime } from '../lib/format'
import { useToast, type ToastTone } from '@/components/composites/use-toast'
import { PROVIDER_NAMES, REPORT_REASON_LABELS } from '../lib/labels'
import { aidNames, aidsOf } from '../lib/aids'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ExternalLinkIcon } from 'lucide-react'
import { Choice } from '@/components/composites/choices'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '@/components/composites/data-table'
import { Tip } from '@/components/composites/tip'
import { AlertDialog, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, LinkButton } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { Note } from '../components/ViewParts'
import {
  actionLog,
  actOnPlayer,
  closeReports,
  findPlayers,
  playerRuns,
  removeRun,
  reportQueue,
  whoAmI,
  type AdminAction,
  type Entry,
  type RunInfo,
  type AdminPlayer,
  type PlayerAction,
  type ReportGroup,
} from './api'

type Tab = 'reports' | 'players' | 'activity'
const TABS: { id: Tab; label: string }[] = [
  { id: 'reports', label: 'Reports' },
  { id: 'players', label: 'Players' },
  { id: 'activity', label: 'Activity' },
]

const REASONS = REPORT_REASON_LABELS
const PROVIDERS = PROVIDER_NAMES
const ACTIONS: Record<string, string> = {
  rename: 'Renamed',
  hide: 'Hid',
  show: 'Showed again',
  signout: 'Signed out everywhere',
  'resolve-reports': 'Resolved reports about',
  'dismiss-reports': 'Dismissed reports about',
  'remove-run': 'Removed a run by',
}

const when = dateTime
const day = date
const message = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** Shows a confirmation, or (tone 'error') a problem that stays until dismissed. */
type Notify = (text: string, tone?: ToastTone) => void

/** Secondary details: dates, ids, who did it. */
function Meta({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-xs text-muted-foreground', className)}>{children}</span>
}

/** A button that asks first, in an alert dialog: focus on Cancel, the action in red. */
function Confirmed({ label, title, description, action, isDisabled, onConfirm }: { label: string; title: string; description: string; action: string; isDisabled?: boolean; onConfirm: () => void }) {
  return (
    <AlertDialogTrigger>
      <Button variant="destructive" size="sm" isDisabled={isDisabled}>
        {label}
      </Button>
      <AlertDialog isDismissable>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
          <Button variant="destructive" slot="close" onPress={onConfirm}>
            {action}
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
    </AlertDialogTrigger>
  )
}

export function Admin() {
  const [email, setEmail] = useState<string | null>(null)
  const [denied, setDenied] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    const hash = location.hash.slice(1)
    return TABS.some((t) => t.id === hash) ? (hash as Tab) : 'reports'
  })
  const toast = useToast()
  // Stable, as the lists reload when it changes.
  const notify = useCallback<Notify>((text, tone) => toast.show(text, { tone }), [toast])

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
    <div className="mx-auto grid max-w-5xl gap-5">
      <header className="flex flex-wrap items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2.5">
          <h1 className="m-0 font-display text-3xl font-bold tracking-tight">
            Syn<span className="text-primary">type</span>
          </h1>
          <Badge variant="destructive" className="font-mono tracking-wider uppercase">
            admin
          </Badge>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {email && (
            <Tip label="Signed in through Cloudflare Access">
              <span tabIndex={0} className="max-sm:hidden">
                {email}
              </span>
            </Tip>
          )}
          <LinkButton variant="outline" size="sm" href="/">
            Back to Syntype
          </LinkButton>
          {email && (
            // Cloudflare Access's own logout: ends the Access session, so the next visit asks for a login again.
            <LinkButton variant="outline" size="sm" href="/cdn-cgi/access/logout">
              Sign out
            </LinkButton>
          )}
        </div>
      </header>

      <main className="grid gap-5">
      {denied ? (
        <Note title="No access" problem>
          {denied}
        </Note>
      ) : !email ? (
        <Note>Checking access…</Note>
      ) : (
        // Tabs remember the section in the address (#players), so a reload or a link keeps it.
        <Tabs selectedKey={tab} onSelectionChange={(k) => show(k as Tab)} className="gap-4">
          <TabsList aria-label="Sections">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} id={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent id="reports">
            <Reports onNotice={notify} />
          </TabsContent>
          <TabsContent id="players">
            <Players onNotice={notify} />
          </TabsContent>
          <TabsContent id="activity">
            <Activity />
          </TabsContent>
        </Tabs>
      )}
      </main>
    </div>
  )
}

function Reports({ onNotice }: { onNotice: Notify }) {
  const [status, setStatus] = useState<'open' | 'closed'>('open')
  const [groups, setGroups] = useState<ReportGroup[] | null>(null)
  const load = useCallback(() => {
    reportQueue(status).then(setGroups, (err) => onNotice(message(err), 'error'))
  }, [status, onNotice])
  useEffect(load, [load])

  const close = async (g: ReportGroup, how: 'resolved' | 'dismissed') => {
    if (!g.player) return
    try {
      const { closed } = await closeReports(g.player.id, g.run, how)
      onNotice(`${how === 'resolved' ? 'Resolved' : 'Dismissed'} ${closed} report${closed === 1 ? '' : 's'}.`)
      load()
    } catch (err) {
      onNotice(message(err), 'error')
    }
  }
  const updated = (p: AdminPlayer) => setGroups((gs) => gs?.map((g) => (g.player?.id === p.id ? { ...g, player: p } : g)) ?? null)

  return (
    <section className="grid gap-3" aria-label="Reports">
      <div className="flex flex-wrap items-center gap-3">
        <Choice
          label="Which reports"
          outline
          options={[
            { id: 'open', label: 'Open' },
            { id: 'closed', label: 'Closed' },
          ]}
          value={status}
          onChange={setStatus}
        />
        <Meta className="text-sm">{status === 'open' ? 'Most reported first.' : 'Most recent first.'}</Meta>
      </div>
      {groups === null ? (
        <Note>Loading…</Note>
      ) : groups.length === 0 ? (
        <Note>{status === 'open' ? 'No open reports. Nothing to do.' : 'No closed reports yet.'}</Note>
      ) : (
        groups.map((g) => (
          <Card key={`${g.player?.id}:${g.run}`} className="gap-3 px-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-1">
                {g.player ? <PlayerName player={g.player} /> : <strong>Deleted player</strong>}
                <Meta>
                  {g.run ? 'A run' : 'The player'} · {g.count} report{g.count === 1 ? '' : 's'} · latest {when(g.latest)}
                </Meta>
                {g.run && <RunLine info={g.runInfo} />}
              </div>
              {status === 'open' && g.player && (
                <div className="flex flex-wrap gap-2">
                  <Tip label="Dealt with: you took action">
                    <Button size="sm" onPress={() => close(g, 'resolved')}>
                      Resolve
                    </Button>
                  </Tip>
                  <Tip label="Nothing wrong">
                    <Button variant="outline" size="sm" onPress={() => close(g, 'dismissed')}>
                      Dismiss
                    </Button>
                  </Tip>
                </div>
              )}
            </div>
            <ul className="m-0 grid list-none gap-2 p-0">
              {g.reports.map((r) => (
                <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-2.5 text-sm max-sm:grid-cols-1 max-sm:gap-1">
                  <Badge variant={r.reason === 'other' ? 'secondary' : 'destructive'} className="justify-self-start">
                    {REASONS[r.reason]}
                  </Badge>
                  {r.note ? <q className="wrap-anywhere">{r.note}</q> : <Meta>No note</Meta>}
                  <Meta>
                    {r.automatic ? 'Syntype (automatic)' : (r.reporter ?? 'a deleted player')} · {when(r.createdAt)}
                    {status === 'closed' && ` · ${r.status}`}
                  </Meta>
                </li>
              ))}
            </ul>
            {g.run && g.runInfo && g.player && status === 'open' && <RunTools runId={g.run} playerId={g.player.id} hasLog={g.runInfo.hasLog} onRemoved={load} onNotice={onNotice} />}
            {g.player && <PlayerTools player={g.player} onChange={updated} onNotice={onNotice} />}
          </Card>
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
          (err) => onNotice(message(err), 'error'),
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
    <section className="grid gap-3" aria-label="Players">
      <div className="flex flex-wrap items-end gap-3">
        {/* No autoFocus: it would pull focus off the tabs as ← → reach Players. */}
        <Field className="max-w-md flex-1">
          <FieldLabel htmlFor="admin-search">Find a player</FieldLabel>
          <Input id="admin-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, player ID or GitHub/Google ID" spellCheck={false} />
        </Field>
        <Meta className="pb-2 text-sm">{q ? '' : 'Newest players first.'}</Meta>
      </div>
      {players === null ? (
        <Note>Loading…</Note>
      ) : players.length === 0 ? (
        <Note>No players match.</Note>
      ) : (
        players.map((p) => (
          <Card key={p.id} className="gap-3 px-4">
            <div className="grid gap-1">
              <PlayerName player={p} />
              <Meta>
                {PROVIDERS[p.provider]} {p.providerId} · joined {day(p.createdAt)} · last seen {day(p.lastSeenAt)}
                {p.openReports > 0 && ` · ${p.openReports} open report${p.openReports === 1 ? '' : 's'}`}
              </Meta>
            </div>
            <PlayerRuns player={p} onNotice={onNotice} />
            <PlayerTools player={p} onChange={updated} onNotice={onNotice} />
          </Card>
        ))
      )}
    </section>
  )
}

function PlayerName({ player }: { player: AdminPlayer }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-2 text-base">
      <strong>{player.name ?? <em className="font-medium text-muted-foreground">No name yet</em>}</strong>
      {!player.name && <Meta>suggested {player.suggestedName}</Meta>}
      {player.hiddenByModerator && <Badge variant="destructive">hidden by you</Badge>}
      {player.hidden && <Badge variant="secondary">hid themselves</Badge>}
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
      onNotice(message(err), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  if (renaming) {
    return (
      <form
        className="flex flex-wrap items-end gap-2 border-t pt-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (await run('rename', { name }, `Renamed to ${name.trim()}. They can't change it for a week.`)) setRenaming(false)
        }}
      >
        <Field className="w-56">
          <FieldLabel htmlFor={`rename-${player.id}`}>New name</FieldLabel>
          <Input id={`rename-${player.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus spellCheck={false} />
        </Field>
        <Button type="submit" size="sm" isDisabled={busy || !name.trim()}>
          Rename
        </Button>
        <Button variant="outline" size="sm" onPress={() => setRenaming(false)}>
          Cancel
        </Button>
      </form>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3">
      <Button
        variant="outline"
        size="sm"
        isDisabled={busy}
        onPress={() => {
          setName(`Player ${1000 + Math.floor(Math.random() * 9000)}`)
          setRenaming(true)
        }}
      >
        Rename…
      </Button>
      {player.hiddenByModerator ? (
        <Button variant="outline" size="sm" isDisabled={busy} onPress={() => run('show', undefined, `${player.name ?? 'Player'} is back on the leaderboards.`)}>
          Show on leaderboards
        </Button>
      ) : (
        <Button variant="destructive" size="sm" isDisabled={busy} onPress={() => run('hide', undefined, `${player.name ?? 'Player'} is hidden from the leaderboards.`)}>
          Hide from leaderboards
        </Button>
      )}
      <Confirmed
        label="Sign out everywhere"
        title={`Sign ${player.name ?? 'this player'} out on every device?`}
        description="Every session they have ends now; they can sign in again."
        action="Sign out everywhere"
        isDisabled={busy}
        onConfirm={() => run('signout', undefined, 'Signed out everywhere.')}
      />
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

  if (error)
    return (
      <Note title="The log couldn’t be loaded" problem>
        {error}
      </Note>
    )
  if (actions === null) return <Note>Loading…</Note>
  if (actions.length === 0) return <Note>No actions yet. Everything you do here is recorded in this log.</Note>
  return (
    <section className="grid gap-3" aria-label="Activity">
      <Card className="py-0">
        <DataTable>
          <DataTableHeader>
            <tr>
              <DataTableHead>When</DataTableHead>
              <DataTableHead>What</DataTableHead>
              <DataTableHead>Who</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {actions.map((a) => (
              <DataTableRow key={a.id}>
                <DataTableCell className="min-w-24 font-mono text-xs whitespace-normal text-muted-foreground">
                  <time dateTime={a.createdAt}>{when(a.createdAt)}</time>
                </DataTableCell>
                <DataTableCell className="whitespace-normal">
                  {ACTIONS[a.action] ?? a.action} <strong>{a.playerName ?? (a.player ? 'a deleted player' : '')}</strong>
                  {a.run && ` (run ${a.run.slice(0, 8)})`}
                  {a.action === 'rename' && a.detail && <RenameDetail detail={a.detail} />}
                </DataTableCell>
                <DataTableCell>
                  <Meta>{a.admin}</Meta>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </Card>
      {more && (
        <Button variant="outline" className="justify-self-start" onPress={() => load(actions[actions.length - 1].createdAt)}>
          Older
        </Button>
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
  return <Meta> (was {from ?? 'unnamed'})</Meta>
}

/** For a reported run: watch its replay (if its keystrokes are kept), or take it off the boards. */
function RunTools({ runId, playerId, hasLog, onRemoved, onNotice }: { runId: string; playerId: string; hasLog: boolean; onRemoved: () => void; onNotice: Notify }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasLog ? (
        <LinkButton variant="outline" size="sm" href={`/leaderboard?replay=${encodeURIComponent(runId)}&admin=1`} target="_blank" rel="noreferrer">
          Watch replay
          <ExternalLinkIcon />
        </LinkButton>
      ) : (
        <Meta>No replay: keystrokes are kept only for each board’s top 20.</Meta>
      )}
      <Confirmed
        label="Remove run"
        title="Take this run off the leaderboards?"
        description="Its keystrokes are deleted too. The player keeps their other runs."
        action="Remove run"
        isDisabled={busy}
        onConfirm={async () => {
          setBusy(true)
          try {
            await removeRun(runId, playerId)
            onNotice('The run is off the leaderboards. Resolve the reports when you’re done.')
            onRemoved()
          } catch (err) {
            onNotice(message(err), 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}

/** A snippet's name, as in code. */
const SNIPPET = 'justify-self-start rounded-md bg-muted px-1.5 py-px font-mono text-xs'

const aidsText = (key: string) => aidNames(aidsOf(key)).join(' + ') || 'no aids'

/** What a reported run is: snippet, speed, aids, date; or that it's no longer on the boards. */
function RunLine({ info }: { info: RunInfo | null }) {
  if (!info) return <Meta className="mt-1.5 block">The run is no longer on the boards (removed, deleted by the player, or replaced by a better run).</Meta>
  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 text-sm">
      <span className={SNIPPET}>
        {info.language} · {info.snippet}
      </span>
      <b>{Math.round(info.wpm)} WPM</b> · {Math.round(info.accuracy)}% · {aidsText(info.aids)} · {when(info.finishedAt)}
    </div>
  )
}

/** A player's leaderboard entries, on demand, each with its replay and a remove. */
function PlayerRuns({ player, onNotice }: { player: AdminPlayer; onNotice: Notify }) {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [open, setOpen] = useState(false)
  const load = () => playerRuns(player.id).then(setEntries, (err) => onNotice(message(err), 'error'))
  if (!open) {
    return (
      <div>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onPress={() => {
            setOpen(true)
            void load()
          }}
        >
          Show leaderboard entries
        </Button>
      </div>
    )
  }
  if (!entries) return <Meta>Loading entries…</Meta>
  if (!entries.length) return <Meta>No leaderboard entries.</Meta>
  return (
    <ul className="m-0 grid list-none gap-2 p-0">
      {entries.map((e) => (
        <li key={e.runId} className="grid gap-1.5 rounded-lg border px-3 py-2.5">
          <span className={SNIPPET}>
            {e.language} · {e.snippet}
          </span>
          <Meta>
            {Math.round(e.wpm)} WPM · {Math.round(e.accuracy)}% · {aidsText(e.aids)} · {when(e.finishedAt)}
          </Meta>
          <RunTools runId={e.runId} playerId={player.id} hasLog={e.hasLog} onRemoved={load} onNotice={onNotice} />
        </li>
      ))}
    </ul>
  )
}
