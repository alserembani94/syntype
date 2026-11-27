/**
 * The global leaderboards (docs/leaderboard.md, "Leaderboards"), at
 * /leaderboard: a language's snippets with each one's top score, one
 * snippet's board (top 15, by typing aids, with your own place), replays of
 * the kept runs, and reports. The data comes from /api/boards (worker/lib/boards.ts).
 */
import { useAddressPlace, type AddressSpec } from '../hooks/useAddressPlace'
import { useEffect, useMemo, useState } from 'react'
import type { Language, LanguageInfo, Snippet, SnippetLength } from '../languages/types'
import { useLanguage } from '../hooks/useLanguage'
import { languageInfo } from '../languages/catalog'
import type { Player } from '../lib/account'
import { AIDS, aidsKey, aidsOf } from '../lib/aids'
import { AidTags } from './AidTags'
import { fetchBoard, fetchLanguageBoards, fetchMyPlace, fetchReplay, sendReport, type Board, type BoardReplay, type BoardRow, type LanguageBoards } from '../lib/boards'
import { fingerprint } from '../lib/runcore'
import { whenPlayed } from '../lib/format'
import { ReplayView } from './ReplayView'
import { LanguagePicker } from './LanguagePicker'
import { FlagIcon, PlayIcon } from 'lucide-react'
import { Choice, Toggles } from '@/components/composites/choices'
import { Crumbs } from '@/components/composites/crumbs'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '@/components/composites/data-table'
import { Tip } from '@/components/composites/tip'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LanguageButton, Mark, Muted, Note, TableSkeleton, ViewHead, ViewTitle } from './ViewParts'
import { ReportDialog } from '@/components/composites/report-dialog'
import { useToast } from '@/components/composites/use-toast'
import { Button } from '@/components/ui/button'

const LENGTHS = (['short', 'medium', 'long'] as const).map((l) => ({ id: l, label: l }))
const AID_OPTIONS = AIDS.map((a) => ({ id: a.id, label: a.name }))
/** The figures in a table: the best in the brand colour, the rest plain. */
const BEST = 'font-display text-base font-bold text-primary'
const FIGURE = 'font-display text-sm font-semibold'

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
  /** The catalog: names and snippet lists. A snippet's board and a replay load their language in full. */
  languages: LanguageInfo[]
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

type Own = Omit<Place, 'language' | 'length'>
const ADDRESS: AddressSpec<Own> = {
  path: '/leaderboard',
  empty: { snippet: null, version: null, aids: 'any', replay: null, admin: false },
  read: (q) => {
    const aids = q.get('aids')
    return { snippet: q.get('snippet'), version: q.get('v'), aids: aids && /^[01]{3}$/.test(aids) ? aids : 'any', replay: q.get('replay'), admin: q.get('admin') === '1' }
  },
  write: (p, q) => {
    if (p.snippet) q.set('snippet', p.snippet)
    if (p.version) q.set('v', p.version)
    if (p.aids !== 'any') q.set('aids', p.aids)
    if (p.replay) q.set('replay', p.replay)
    if (p.admin) q.set('admin', '1')
  },
}

export function LeaderboardView({ languages, language, length, onLanguage, onLength, player, onType, inAddress = true }: Props) {
  const [place, go] = useAddressPlace(ADDRESS, { language, length, onLanguage, onLength, inAddress })
  const lang = languages.find((l) => l.id === place.language) ?? languages[0]
  // A snippet's board fingerprints the snippet's text, so it needs the language in full.
  const { language: full, failed } = useLanguage(place.snippet && !place.replay ? lang.id : null)

  if (place.replay) return <BoardReplayView runId={place.replay} admin={place.admin} onClose={() => go({ replay: null, admin: false }, true)} />
  if (place.snippet && !full) return <LanguageLoading name={lang.name} failed={failed} onBack={() => go({ snippet: null, version: null, aids: 'any' }, true)} />
  if (place.snippet && full) {
    return (
      <SnippetBoard
        lang={full}
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
  languages: LanguageInfo[]
  lang: LanguageInfo
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
    <section className="grid min-w-0 gap-4" aria-labelledby="boards-title">
      <ViewHead>
        <ViewTitle id="boards-title">Leaderboards</ViewTitle>
        <p className="m-0 text-sm text-muted-foreground">Each snippet has its own board: signed-in players’ best runs, at least 75% accurate, checked by replaying their keystrokes.</p>
      </ViewHead>
      {/* The game's own language button and picker (search, sections), so the list can keep growing. */}
      <div className="flex flex-wrap items-center gap-2">
        <LanguageButton name={lang.name} onPress={() => setPicking(true)} />
        <Choice label="Length" options={LENGTHS} value={length} onChange={onLength} />
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
        <Note title="The boards couldn’t be loaded" problem>
          {loaded.error}
        </Note>
      ) : !boards ? (
        <TableSkeleton columns={4} rows={snippets.length || 5} />
      ) : (
        <Card className="py-0">
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>Snippet</DataTableHead>
                <DataTableHead numeric>Top WPM</DataTableHead>
                <DataTableHead>Held by</DataTableHead>
                <DataTableHead>
                  <span className="sr-only">Open</span>
                </DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {snippets.map((s) => {
                const top = byName.get(s.name)?.top
                return (
                  <DataTableRow key={s.name} onOpen={() => onOpen(s.name, null)}>
                    <DataTableCell className="font-mono">{s.name}</DataTableCell>
                    <DataTableCell numeric className={top ? BEST : undefined}>
                      {top ? Math.round(top.wpm) : '–'}
                    </DataTableCell>
                    <DataTableCell>{top ? top.name : <Muted>no runs yet</Muted>}</DataTableCell>
                    <DataTableCell className="text-right">
                      <Button variant="link" size="sm" className="h-auto p-0" aria-label={`${s.name} board`} onPress={() => onOpen(s.name, null)}>
                        board ›
                      </Button>
                    </DataTableCell>
                  </DataTableRow>
                )
              })}
            </DataTableBody>
          </DataTable>
        </Card>
      )}
      {archived.length > 0 && (
        <div className="grid gap-1.5">
          <h3 className="m-0 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Older versions</h3>
          <Muted>These snippets have since changed, so their boards are closed. Their runs and replays stay.</Muted>
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">
            {archived.map((a) => (
              <li key={a.fingerprint}>
                <Button variant="link" size="sm" className="h-auto p-0 font-mono" onPress={() => onOpen(a.name, a.fingerprint)}>
                  {a.name}
                </Button>{' '}
                <Muted>first played {whenPlayed(a.since)}</Muted>
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
  const toast = useToast()
  const onReported = () => toast.show('Thanks. The report was sent to the moderator.')

  if (!snippet && !version) {
    return (
      <section className="grid min-w-0 gap-4">
        <Note title="No such snippet" action={<Button variant="outline" onPress={onBack}>‹ {lang.name} boards</Button>}>
          There’s no snippet called {name} in {lang.name}.
        </Note>
      </section>
    )
  }
  const board = data?.board
  const archived = board ? !board.snippet.current : !!version
  const mine = data?.mine
  const inTop = mine && board?.rows.some((r) => r.player.id === mine.player.id)
  const custom = aids !== 'any' ? aidsOf(aids) : null

  return (
    <section className="grid min-w-0 gap-4" aria-labelledby="board-title">
      <ViewHead
        action={
          !archived &&
          snippet && <Button onPress={onType}>Type this snippet</Button>
        }
      >
        <Crumbs
          trail={[{ label: 'Leaderboards', onPress: onBack }, { label: lang.name, onPress: onBack }]}
          currentId="board-title"
          current={
            <>
              {name}
              {archived && <Mark tone="muted">older version</Mark>}
            </>
          }
        />
      </ViewHead>

      <div className="flex flex-wrap items-center gap-2">
        <Muted className="text-sm">typing aids</Muted>
        <Choice
          label="Typing aids"
          outline
          options={[
            { id: 'any', label: 'any' },
            { id: 'exactly', label: 'exactly', tip: 'Only runs with exactly the aids you choose' },
          ]}
          value={custom ? 'exactly' : 'any'}
          onChange={(v) => onAids(v === 'any' ? 'any' : '110')}
        />
        {custom && <Toggles label="Exactly these aids" options={AID_OPTIONS} on={custom} onToggle={(id) => onAids(aidsKey({ ...custom, [id]: !custom[id] }))} />}
      </div>

      {data?.error ? (
        <Note title="The board couldn’t be loaded" problem>
          {data.error}
        </Note>
      ) : !data ? (
        <TableSkeleton columns={6} />
      ) : board && board.rows.length === 0 ? (
        <Note title="No runs yet">{aids === 'any' ? 'No runs on this board yet. Sign in and type it to be the first.' : 'No runs with exactly these typing aids yet.'}</Note>
      ) : (
        <Card className="py-0">
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead numeric>#</DataTableHead>
                <DataTableHead>Player</DataTableHead>
                <DataTableHead numeric>WPM</DataTableHead>
                <DataTableHead numeric>Accuracy</DataTableHead>
                <DataTableHead className="max-sm:hidden">Typing aids</DataTableHead>
                <DataTableHead className="max-sm:hidden">When</DataTableHead>
                <DataTableHead>Replay</DataTableHead>
                <DataTableHead>
                  <span className="sr-only">Report</span>
                </DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {board?.rows.map((r) => (
                <Row key={r.runId} row={r} mine={r.player.id === player?.id} canReport={!!player?.name && r.player.id !== player.id} onReplay={onReplay} onReported={onReported} />
              ))}
              {mine && !inTop && (
                <>
                  {/* How far down "you" are: the players between the top 15 and you. */}
                  <DataTableRow>
                    <DataTableCell colSpan={8} className="py-1 text-center text-xs text-muted-foreground">
                      {mine.rank - (board?.rows.length ?? 0) > 1
                        ? `⋯ ${mine.rank - (board?.rows.length ?? 0) - 1} more ${mine.rank - (board?.rows.length ?? 0) - 1 === 1 ? 'player' : 'players'} ⋯`
                        : '⋯'}
                    </DataTableCell>
                  </DataTableRow>
                  <Row row={mine} mine canReport={false} onReplay={onReplay} onReported={onReported} />
                </>
              )}
            </DataTableBody>
          </DataTable>
        </Card>
      )}
      {!player && <Muted className="text-sm">Sign in to put your own runs on the boards.</Muted>}
    </section>
  )
}

function Row({ row: r, mine, canReport, onReplay, onReported }: { row: BoardRow; mine: boolean; canReport: boolean; onReplay: (id: string) => void; onReported: () => void }) {
  return (
    <DataTableRow className={cn(mine && 'bg-accent/60')} data-mine={mine || undefined}>
      <DataTableCell numeric className="text-muted-foreground">
        {r.rank}
      </DataTableCell>
      <DataTableCell className="font-mono">
        {r.player.name}
        {mine && <Mark>you</Mark>}
      </DataTableCell>
      <DataTableCell numeric className={BEST}>
        {Math.round(r.wpm)}
      </DataTableCell>
      <DataTableCell numeric className={FIGURE}>
        {Math.round(r.accuracy)}%
      </DataTableCell>
      <DataTableCell className="max-sm:hidden">
        <AidTags aids={aidsOf(r.aids)} />
      </DataTableCell>
      <DataTableCell className="max-sm:hidden">{whenPlayed(r.finishedAt)}</DataTableCell>
      <DataTableCell>
        {r.hasLog ? (
          <Button variant="link" size="sm" className="h-auto p-0" aria-label={`Replay ${r.player.name}’s run`} onPress={() => onReplay(r.runId)}>
            <PlayIcon className="fill-current" />
            replay
          </Button>
        ) : (
          <Tip label="Replays are kept for each board’s top 20">
            <Button variant="ghost" size="xs" className="h-auto cursor-help px-0 text-muted-foreground hover:bg-transparent" aria-label="No replay: replays are kept for each board’s top 20">
              –
            </Button>
          </Tip>
        )}
      </DataTableCell>
      <DataTableCell>
        {canReport && (
          <ReportDialog
            playerName={r.player.name}
            trigger={
              <Tip label="Report">
                <Button variant="ghost" size="icon-sm" aria-label={`Report ${r.player.name}’s run`}>
                  <FlagIcon />
                </Button>
              </Tip>
            }
            onSend={({ reason, note }) => sendReport({ player: r.player.id, run: reason === 'name' ? undefined : r.runId, reason, note })}
            onSent={onReported}
          />
        )}
      </DataTableCell>
    </DataTableRow>
  )
}

/** While a language's rules and snippets load (normally a moment); if they can't, says so. */
function LanguageLoading({ name, failed, onBack }: { name: string; failed: boolean; onBack: () => void }) {
  if (!failed) return <section className="grid min-w-0 gap-4" aria-busy="true" aria-label={`Loading ${name}`} />
  return (
    <section className="grid min-w-0 gap-4">
      <Note title={`${name} couldn’t be loaded`} problem action={<Button variant="outline" onPress={onBack}>‹ Back</Button>}>
        Check your connection and try again.
      </Note>
    </section>
  )
}

function BoardReplayView({ runId, admin, onClose }: { runId: string; admin: boolean; onClose: () => void }) {
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
  const { language: lang, failed } = useLanguage(replay?.snippet.language ?? null)
  // Stable objects for the replay, so it loads once.
  const parts = useMemo(() => {
    if (!replay || !lang) return null
    const snippet: Snippet = { name: replay.snippet.name, code: replay.snippet.code, length: replay.snippet.length }
    return { lang, snippet, run: { wpm: replay.wpm, accuracy: replay.accuracy, finishedAt: replay.finishedAt, aids: aidsOf(replay.aids) } }
  }, [replay, lang])

  if (failed) return <LanguageLoading name={languageInfo(replay!.snippet.language).name} failed onBack={onClose} />
  if (loaded && 'error' in loaded) {
    return (
      <section className="grid min-w-0 gap-4">
        <Note title="The replay couldn’t be loaded" problem action={<Button variant="outline" onPress={onClose}>‹ Back</Button>}>
          {loaded.error}
        </Note>
      </section>
    )
  }
  if (!replay || !parts) return <section className="grid min-w-0 gap-4" aria-busy="true" aria-label="Loading the replay" />
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
