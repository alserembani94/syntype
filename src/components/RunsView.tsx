import { useEffect, useMemo, useRef, useState } from 'react'
import { PlayIcon } from 'lucide-react'
import { Choice, Toggles } from '@/components/composites/choices'
import { Crumbs } from '@/components/composites/crumbs'
import { DataTable, DataTableBody, DataTableCell, DataTableHead, DataTableHeader, DataTableRow } from '@/components/composites/data-table'
import { Tip } from '@/components/composites/tip'
import { useToast } from '@/components/composites/use-toast'
import { AlertDialog, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AidTags } from './AidTags'
import { LanguagePicker } from './LanguagePicker'
import { LanguageButton, Mark, Muted, Note, Stat, TableSkeleton, ViewHead, ViewTitle } from './ViewParts'
import type { Language, SnippetLength } from '../languages'
import { AIDS } from '../lib/aids'
import { keepSafe, snippetKey, storageInfo, type History, type StoredRun } from '../lib/history'
import { fingerprint } from '../lib/runlog'
import { matchesAids, overview, snippetStats, type AidsFilter } from '../lib/board'
import { duration, runTime, speed, whenPlayed } from '../lib/format'
import type { TypingAids } from '../lib/runcore'
import { ReplayView } from './ReplayView'
import { useAddressPlace, type AddressSpec } from '../hooks/useAddressPlace'

const LENGTHS = (['short', 'medium', 'long'] as const).map((l) => ({ id: l, label: l }))

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

const ADDRESS: AddressSpec<{ snippet: string | null; replay: string | null }> = {
  path: '/runs',
  empty: { snippet: null, replay: null },
  read: (q) => ({ snippet: q.get('snippet'), replay: q.get('replay') }),
  write: (p, q) => {
    if (p.snippet) q.set('snippet', p.snippet)
    if (p.replay) q.set('replay', p.replay)
  },
}

/** The personal board: every run kept on this device (docs/leaderboard.md). */
export function RunsView({ languages, history, language, length, onLanguage, onLength, inAddress, onType }: Props) {
  const [place, go] = useAddressPlace(ADDRESS, { language, length, onLanguage, onLength, inAddress })
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
      <section className="grid min-w-0 gap-4">
        <ViewTitle>My runs</ViewTitle>
        <Note title="Nothing saved on this device">
          This browser isn't letting Syntype save runs on this device (a private window, or storage turned off), so there's nothing to show. Typing still works as usual.
        </Note>
      </section>
    )
  }
  if (!runs || store === undefined) {
    return (
      <section className="grid min-w-0 gap-4">
        <ViewTitle>My runs</ViewTitle>
        <TableSkeleton columns={6} />
      </section>
    )
  }

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


const AID_OPTIONS = AIDS.map((a) => ({ id: a.id, label: a.name }))
const FILTERS = [
  { id: 'any', label: 'any' },
  { id: 'on', label: 'all on' },
  { id: 'off', label: 'all off' },
  { id: 'custom', label: 'custom' },
] as const

/** Which runs to count by their typing aids: any, all on, all off, or exactly a chosen set. */
function AidsFilterBar({ value, onChange }: { value: AidsFilter; onChange: (f: AidsFilter) => void }) {
  const custom = typeof value === 'object' ? value : null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Muted className="text-sm">typing aids</Muted>
      <Choice
        label="Typing aids"
        outline
        options={FILTERS}
        value={custom ? 'custom' : (value as 'any' | 'on' | 'off')}
        onChange={(f) => onChange(f === 'custom' ? { autoIndent: true, autoClose: true, autocomplete: false } : f)}
      />
      {custom && <Toggles label="Exactly these aids" options={AID_OPTIONS} on={custom} onToggle={(id: keyof TypingAids) => onChange({ ...custom, [id]: !custom[id] })} />}
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <Muted>{values.length ? 'one run' : ''}</Muted>
  const w = 90
  const h = 22
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const y = (v: number) => (hi === lo ? h / 2 : h - 3 - ((v - lo) / (hi - lo)) * (h - 6))
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="block text-primary" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`last ${values.length} runs: ${values.map(Math.round).join(', ')} wpm`}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** The figures in a table: the best in the brand colour, the rest plain. */
const BEST = 'font-display text-base font-bold text-primary'
const FIGURE = 'font-display text-[0.9375rem] font-semibold'

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
  const [picking, setPicking] = useState(false)
  const o = overview(runs, length)
  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const r of runs) c.set(r.language, (c.get(r.language) ?? 0) + 1)
    return c
  }, [runs])
  const since = runs.length ? runs.reduce((a, r) => (r.finishedAt < a ? r.finishedAt : a), runs[0].finishedAt) : null
  const bestLang = o.best && languages.find((l) => l.id === o.best!.language)
  const change = o.last10 !== null && o.previous10 !== null ? o.last10 - o.previous10 : null
  const first = lang.snippets.find((s) => s.length === length)!.name

  const rows = lang.snippets
    .filter((s) => s.length === length)
    .map((s) => ({ name: s.name, stats: snippetStats(snippetRuns(s.name).filter((r) => matchesAids(aids, r.aids))) }))
    .sort((a, b) => (b.stats?.best?.wpm ?? -1) - (a.stats?.best?.wpm ?? -1) || (b.stats ? 1 : 0) - (a.stats ? 1 : 0) || a.name.localeCompare(b.name))

  return (
    <section className="grid min-w-0 gap-4" aria-labelledby="runs-title">
      <ViewHead>
        <ViewTitle id="runs-title">My runs</ViewTitle>
        <p className="m-0 text-sm text-muted-foreground">
          Saved in this browser only.
          {since && ` ${runs.length} ${runs.length === 1 ? 'run' : 'runs'} since ${new Date(since).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}.`}
        </p>
      </ViewHead>

      {runs.length === 0 ? (
        <Note title="No runs yet" action={<Button onPress={() => onType(first)}>Start typing</Button>}>
          Every snippet you finish is saved here, with its speed, accuracy and a replay.
        </Note>
      ) : (
        <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
          <Stat label="runs" value={o.runs} note={`across ${o.languages} ${o.languages === 1 ? 'language' : 'languages'}`} />
          <Stat label="time typing" value={duration(o.seconds)} note="pauses not counted" />
          <Stat label={`best (${length})`} value={o.best ? `${Math.round(o.best.wpm)} wpm` : '–'} note={o.best ? `${o.best.snippet} · ${bestLang?.name ?? o.best.language}` : `no accurate ${length} run yet`} />
          <Stat
            label="last 10 runs"
            value={o.last10 !== null ? `${Math.round(o.last10)} wpm` : '–'}
            note={change === null ? 'compared once you have 20 runs' : `${change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(change))} from the 10 before`}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <LanguageButton name={lang.name} onPress={() => setPicking(true)} />
        <Choice label="Length" options={LENGTHS} value={length} onChange={onLength} />
        <AidsFilterBar value={aids} onChange={setAids} />
      </div>
      {picking && (
        <LanguagePicker
          languages={languages}
          currentId={lang.id}
          detail={(l) => {
            const n = counts.get(l.id)
            return n ? `${n} ${n === 1 ? 'run' : 'runs'}` : ''
          }}
          onSelect={(id) => {
            setPicking(false)
            onLanguage(id)
          }}
          onClose={() => setPicking(false)}
        />
      )}

      <Card className="py-0">
        <DataTable>
          <DataTableHeader>
            <tr>
              <DataTableHead>Snippet</DataTableHead>
              <DataTableHead numeric>Best</DataTableHead>
              <DataTableHead numeric>Average</DataTableHead>
              <DataTableHead numeric>Accuracy</DataTableHead>
              <DataTableHead numeric>Runs</DataTableHead>
              <DataTableHead className="max-sm:hidden">Trend</DataTableHead>
              <DataTableHead className="max-sm:hidden">Last played</DataTableHead>
              <DataTableHead>
                <span className="sr-only">Action</span>
              </DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {rows.map(({ name, stats }) =>
              stats ? (
                <DataTableRow key={name} onOpen={() => onOpen(name)}>
                  <DataTableCell className="font-mono">{name}</DataTableCell>
                  <DataTableCell numeric className={BEST}>
                    {stats.best ? Math.round(stats.best.wpm) : '–'}
                  </DataTableCell>
                  <DataTableCell numeric className={FIGURE}>
                    {Math.round(stats.averageWpm)}
                  </DataTableCell>
                  <DataTableCell numeric className={FIGURE}>
                    {Math.round(stats.averageAccuracy)}%
                  </DataTableCell>
                  <DataTableCell numeric className={FIGURE}>
                    {stats.runs}
                  </DataTableCell>
                  <DataTableCell className="max-sm:hidden">
                    <Sparkline values={stats.trend} />
                  </DataTableCell>
                  <DataTableCell className="max-sm:hidden">{whenPlayed(stats.lastPlayed)}</DataTableCell>
                  <DataTableCell className="text-right">
                    <Button variant="link" size="sm" className="h-auto p-0" aria-label={`Open ${name}`} onPress={() => onOpen(name)}>
                      open ›
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ) : (
                <DataTableRow key={name} className="text-muted-foreground">
                  <DataTableCell className="font-mono">{name}</DataTableCell>
                  <DataTableCell numeric>–</DataTableCell>
                  <DataTableCell numeric>–</DataTableCell>
                  <DataTableCell numeric>–</DataTableCell>
                  <DataTableCell numeric>0</DataTableCell>
                  <DataTableCell className="max-sm:hidden" />
                  <DataTableCell className="max-sm:hidden">{aids === 'any' ? 'not played yet' : 'none with these aids'}</DataTableCell>
                  <DataTableCell className="text-right">
                    <Button variant="link" size="sm" className="h-auto p-0" aria-label={`Type it: ${name}`} onPress={() => onType(name)}>
                      type it ›
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ),
            )}
          </DataTableBody>
        </DataTable>
      </Card>

      <StorageRow store={store} language={lang} onChanged={onChanged} />
    </section>
  )
}

function StorageRow({ store, language, onChanged }: { store: History; language: Language; onChanged: () => void }) {
  const [info, setInfo] = useState<{ bytes: number | null; persisted: boolean } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
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
    toast.show(`Exported ${data.runs.length} runs.`)
  }

  const importFile = async (file: File) => {
    try {
      const { added, skipped } = await store.importAll(JSON.parse(await file.text()))
      toast.show(`Imported ${added} ${added === 1 ? 'run' : 'runs'}${skipped ? `; ${skipped} already here or unreadable` : ''}.`)
      onChanged()
    } catch (err) {
      toast.show(err instanceof SyntaxError ? 'That file isn’t a Syntype history file.' : (err as Error).message, { tone: 'error' })
    }
  }

  const clear = async (lang?: string) => {
    await store.clear(lang)
    setConfirming(false)
    toast.show(lang ? `Cleared your ${language.name} runs.` : 'Cleared all runs on this device.')
    onChanged()
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span className="mr-1">
        Saved in this browser{info?.bytes != null && ` · ${size(info.bytes)}`}
        {info?.persisted && ' · kept safe ✓'}
      </span>
      {info && !info.persisted && (
        <Tip label="Ask the browser not to delete this site’s data when the disk fills up">
          <Button
            variant="outline"
            size="sm"
            onPress={async () => {
              const kept = await keepSafe()
              setInfo({ ...info, persisted: kept })
              toast.show(kept ? 'Your browser will keep your history.' : 'Your browser didn’t agree this time. Export a copy to be sure.')
            }}
          >
            Keep my history safe
          </Button>
        </Tip>
      )}
      <Button variant="outline" size="sm" onPress={exportFile}>
        Export
      </Button>
      <Button variant="outline" size="sm" onPress={() => fileRef.current?.click()}>
        Import
      </Button>
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
      <Button variant="destructive" size="sm" onPress={() => setConfirming(true)}>
        Clear…
      </Button>
      <AlertDialog isOpen={confirming} onOpenChange={setConfirming} isDismissable>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear runs on this device?</AlertDialogTitle>
          <AlertDialogDescription>Runs, their replays and your bests here are deleted. Runs on the leaderboards stay. Export a copy first if you want to keep them.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:flex-wrap">
          <AlertDialogCancel autoFocus>Cancel</AlertDialogCancel>
          <Button variant="destructive" onPress={() => clear(language.id)}>
            Clear {language.name} runs
          </Button>
          <Button variant="destructive" onPress={() => clear()}>
            Clear everything
          </Button>
        </AlertDialogFooter>
      </AlertDialog>
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
    <section className="grid min-w-0 gap-4" aria-labelledby="snippet-title">
      <ViewHead action={<Button onPress={onType}>Type this snippet</Button>}>
        <Crumbs trail={[{ label: 'My runs', onPress: onBack }, { label: lang.name }, { label: length }]} current={name} />
        <ViewTitle id="snippet-title">{name}</ViewTitle>
      </ViewHead>

      {stats ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,16rem)] gap-3 max-md:grid-cols-1">
          <Card size="sm" className="min-w-0 gap-2 px-4">
            <span className="font-mono text-sm text-muted-foreground">WPM per run · best so far highlighted</span>
            <RunsChart runs={[...shown].sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))} best={stats.best} />
          </Card>
          <div className="grid content-start gap-3">
            <Stat
              label="best"
              value={stats.best ? `${Math.round(stats.best.wpm)} wpm` : '–'}
              note={stats.best ? `${Math.round(stats.best.accuracy)}% accuracy · ${whenPlayed(stats.best.finishedAt)}` : 'no run accurate enough yet'}
            />
            <Stat label={`average of ${stats.runs}`} plain value={`${Math.round(stats.averageWpm)} wpm`} note={`${stats.averageAccuracy.toFixed(1)}% accuracy`} />
          </div>
        </div>
      ) : (
        <Note title={runs.length ? 'No runs with these typing aids' : 'Not typed yet'} action={!runs.length && <Button onPress={onType}>Type it now</Button>}>
          {runs.length ? 'Try another filter.' : 'Your runs of this snippet will show here.'}
        </Note>
      )}

      {runs.length > 0 && <AidsFilterBar value={aids} onChange={setAids} />}

      {newestFirst.length > 0 && (
        <Card className="py-0">
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>When</DataTableHead>
                <DataTableHead numeric>WPM</DataTableHead>
                <DataTableHead numeric>Raw</DataTableHead>
                <DataTableHead numeric>Accuracy</DataTableHead>
                <DataTableHead numeric>Time</DataTableHead>
                <DataTableHead className="max-sm:hidden">Typing aids</DataTableHead>
                {anySubmitted && <DataTableHead>Leaderboard</DataTableHead>}
                <DataTableHead>Replay</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {newestFirst.map((r) => (
                <DataTableRow key={r.id}>
                  <DataTableCell>{runTime(r.finishedAt)}</DataTableCell>
                  <DataTableCell numeric className={r.id === stats?.best?.id ? BEST : FIGURE}>
                    {Math.round(r.wpm)}
                    {r.id === stats?.best?.id && <Mark>best</Mark>}
                  </DataTableCell>
                  <DataTableCell numeric className={FIGURE}>
                    {Math.round(r.rawWpm)}
                  </DataTableCell>
                  <DataTableCell numeric className={FIGURE}>
                    {Math.round(r.accuracy)}%
                  </DataTableCell>
                  <DataTableCell numeric className={FIGURE}>
                    {duration(r.seconds)}
                  </DataTableCell>
                  <DataTableCell className="max-sm:hidden">
                    <AidTags aids={r.aids} />
                  </DataTableCell>
                  {anySubmitted && <DataTableCell>{boardCell(r)}</DataTableCell>}
                  <DataTableCell>
                    {r.hasLog ? (
                      <Button variant="link" size="sm" className="h-auto p-0" aria-label={`Replay the run from ${runTime(r.finishedAt)}`} onPress={() => onReplay(r.id)}>
                        <PlayIcon className="fill-current" />
                        replay
                      </Button>
                    ) : (
                      <Explained label="Logs are kept for each snippet's best 3 runs and your last 10">log not kept</Explained>
                    )}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </Card>
      )}
    </section>
  )
}

/**
 * Text with an explanation in a tooltip. Focusable, so keyboard users can read
 * the explanation too (a title attribute only shows on hover).
 */
function Explained({ label, children, problem }: { label: string; children: React.ReactNode; problem?: boolean }) {
  return (
    <Tip label={label}>
      <Button variant="ghost" size="xs" className={cn('h-auto cursor-help px-0 font-normal underline decoration-dotted underline-offset-4 hover:bg-transparent', problem ? 'text-destructive' : 'text-muted-foreground')}>
        {children}
      </Button>
    </Tip>
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
          <line className="gridline" x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} />
          <text className="axis" x={pad.l - 6} y={y(t) + 3} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {runs.length > 1 && <polyline className="runs-line" points={runs.map((r, i) => `${x(i)},${y(r.wpm)}`).join(' ')} />}
      {runs.map((r, i) => (
        <circle key={r.id} className={r.id === best?.id ? 'runs-dot best' : 'runs-dot'} cx={x(i)} cy={y(r.wpm)} r={r.id === best?.id ? 5 : 3.5}>
          <title>{`${runTime(r.finishedAt)}: ${speed(r)}`}</title>
        </circle>
      ))}
    </svg>
  )
}

/** What happened to a run on the leaderboard, for its row in the run list. */
function boardCell(r: StoredRun) {
  const sub = r.submission
  if (!sub) return <Muted>–</Muted>
  switch (sub.status) {
    case 'accepted':
      return <Explained label={sub.best ? 'A new best on the leaderboard when it was sent' : 'Accepted; an earlier run was your best'}>{sub.best ? `#${sub.rank}` : 'accepted'}</Explained>
    case 'rejected':
      return (
        <Explained label={sub.message} problem>
          rejected
        </Explained>
      )
    case 'failed':
      return <Explained label={sub.message}>not sent</Explained>
  }
}
