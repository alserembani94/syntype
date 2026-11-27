/**
 * Account & data (docs/leaderboard.md, "Player actions"): the leaderboard
 * name, hiding from the boards, the player's entries (each can be deleted),
 * downloading everything the server keeps, and deleting the account.
 */
import { useEffect, useState } from 'react'
import { LANGUAGES } from '../languages'
import { deleteAccount, deleteEntry, downloadData, fetchEntries, setHidden, signOutEverywhere, type Entry, type Player } from '../lib/account'
import { speed, whenPlayed } from '../lib/format'
import { PROVIDER_NAMES as PROVIDERS } from '../lib/labels'
import { POLICY_LINKS } from '../seo/policyLinks'
import { LabelledCheckbox } from '@/components/composites/labelled'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AccountDialog } from './AccountDialogs'

/** A text button inside a sentence (Change name, delete). */
const INLINE = 'h-auto p-0 align-baseline'
const NOTE = 'text-xs text-muted-foreground'

/** Where players remove Syntype from the apps connected to their account. */
const CONNECTED_APPS = { github: 'https://github.com/settings/applications', google: 'https://myaccount.google.com/connections' }

interface Props {
  player: Player
  onClose: () => void
  onRename: () => void
  onPlayer: (p: Player) => void
  /** The account is gone; `clearLocal` asks to clear this device's run history too. */
  onDeleted: (clearLocal: boolean) => Promise<void>
  /** Every session has ended, this one too. */
  onSignedOut: () => void
}

export function AccountSettings({ player, onClose, onRename, onPlayer, onDeleted, onSignedOut }: Props) {
  const [entries, setEntries] = useState<Entry[] | null | 'error'>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const [clearLocal, setClearLocal] = useState(true)
  const [deleted, setDeleted] = useState(false)
  // The switch's position while the server catches up.
  const [hiddenNow, setHiddenNow] = useState<boolean | null>(null)
  const hidden = hiddenNow ?? player.hidden

  useEffect(() => {
    let live = true
    fetchEntries().then((e) => live && setEntries(e ?? 'error'))
    return () => {
      live = false
    }
  }, [])

  const name = player.name ?? player.suggestedName
  const langName = (id: string) => LANGUAGES.find((l) => l.id === id)?.name ?? id

  if (deleted) {
    return (
      <AccountDialog title="Your account is deleted" onClose={onClose}>
        <p className="text-muted-foreground">
          Your name, scores and replays are off Syntype’s leaderboards and out of its database. Backups that still hold them are gone within 30 days at most.
        </p>
        <p className="text-muted-foreground">
          To finish, you can remove Syntype from the apps connected to your {PROVIDERS[player.provider]} account:{' '}
          <a href={CONNECTED_APPS[player.provider]} target="_blank" rel="noreferrer" className="text-primary">
            {PROVIDERS[player.provider]} settings ↗
          </a>
        </p>
        <DialogFooter>
          <Button autoFocus slot="close">
            Done
          </Button>
        </DialogFooter>
      </AccountDialog>
    )
  }

  return (
    <AccountDialog
      title="Account & data"
      description={
        <>
          Signed in with {PROVIDERS[player.provider]} as <b className="text-foreground">{name}</b>.{' '}
          <Button variant="link" className={INLINE} onPress={onRename}>
            Change name
          </Button>
        </>
      }
      onClose={onClose}
      className="sm:max-w-xl"
    >

      <section className="grid gap-2 border-t pt-3" aria-labelledby="acct-boards">
        <h3 id="acct-boards" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Leaderboards</h3>
        <LabelledCheckbox
          label="Show me on the leaderboards"
          aria-describedby="acct-boards-hint"
          isSelected={!hidden}
          onChange={async (shown) => {
              // Moves at once; moves back if the server says no.
              const hide = !shown
              setHiddenNow(hide)
              const r = await setHidden(hide)
              if (r.ok) onPlayer(r.body.player)
              else {
                setHiddenNow(null)
                setProblem(r.error)
              }
            }}
        />
        <p id="acct-boards-hint" className={NOTE}>
          {hidden ? 'Hidden: nobody else sees your runs or name. Your runs are still kept, and you still see your own place.' : 'Your name and best runs are public on each snippet’s board.'}
        </p>
        {player.hiddenByModerator && <p className="text-xs text-destructive">A moderator has hidden you from the leaderboards, so you stay hidden whatever this switch says.</p>}
      </section>

      <section className="grid gap-2 border-t pt-3" aria-labelledby="acct-entries">
        <h3 id="acct-entries" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Your entries</h3>
        {entries === null ? (
          <p className={NOTE}>Loading…</p>
        ) : entries === 'error' ? (
          <p className="text-xs text-destructive">Your entries couldn’t be loaded.</p>
        ) : entries.length === 0 ? (
          <p className={NOTE}>No runs on the leaderboards yet.</p>
        ) : (
          <ul className="m-0 grid max-h-56 list-none divide-y overflow-y-auto rounded-lg border p-0">
            {entries.map((e) => (
              <li key={e.runId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <span className="truncate font-mono">
                  {langName(e.language)} · {e.snippet}
                </span>
                <span className="whitespace-nowrap text-muted-foreground tabular-nums max-sm:col-start-1">
                  {speed(e)} · {whenPlayed(e.finishedAt)}
                </span>
                {confirming === e.runId ? (
                  <span className="flex gap-1.5">
                    <Button
                      variant="destructive"
                      size="xs"
                      isDisabled={busy}
                      onPress={async () => {
                        setBusy(true)
                        const r = await deleteEntry(e.runId)
                        setBusy(false)
                        setConfirming(null)
                        if (!r.ok) return setProblem(r.error)
                        setEntries(await fetchEntries().then((x) => x ?? 'error'))
                      }}
                    >
                      Delete
                    </Button>
                    <Button variant="outline" size="xs" onPress={() => setConfirming(null)}>
                      Keep
                    </Button>
                  </span>
                ) : (
                  <Button variant="link" className={INLINE} onPress={() => setConfirming(e.runId)} aria-label={`Delete your ${e.snippet} run`}>
                    delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className={NOTE}>Deleting a run takes it off its board. If you have a run on the same snippet with other typing aids, that one takes its place.</p>
      </section>

      <section className="grid gap-2 border-t pt-3" aria-labelledby="acct-sessions">
        <h3 id="acct-sessions" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Devices</h3>
        <p className={NOTE}>Signs you out on every device and browser where you’re signed in, this one included. Use it if you signed in somewhere you no longer use.</p>
        <div>
          <Button
            variant="outline"
            isDisabled={busy}
            onPress={async () => {
              setBusy(true)
              const r = await signOutEverywhere()
              setBusy(false)
              if (r.ok) onSignedOut()
              else setProblem(r.error)
            }}
          >
            Sign out everywhere
          </Button>
        </div>
      </section>

      <section className="grid gap-2 border-t pt-3" aria-labelledby="acct-data">
        <h3 id="acct-data" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Your data</h3>
        <p className={NOTE}>A file with everything Syntype keeps about you: your account, best scores, kept keystroke logs, the reports you sent, and reports and moderator actions about you (without other people’s details). Your run history stays on this device (My runs has its own export).</p>
        <div>
          <Button
            variant="outline"
            onPress={async () => {
              const r = await downloadData()
              if (r) setProblem(r)
            }}
          >
            Download my data
          </Button>
        </div>
      </section>

      <section className="grid gap-2 border-t pt-3" aria-labelledby="acct-delete">
        <h3 id="acct-delete" className="text-xs font-semibold tracking-wider text-destructive uppercase">Delete account</h3>
        {!deleting ? (
          <>
            <p className={NOTE}>Deletes your name, scores and replays from Syntype at once. Reports you sent stay, without your name.</p>
            <div>
              <Button variant="destructive" onPress={() => setDeleting(true)}>
                Delete my account…
              </Button>
            </div>
          </>
        ) : (
          <form
            className="grid gap-2.5"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              const r = await deleteAccount(typed)
              if (!r.ok) {
                setBusy(false)
                return setProblem(r.error)
              }
              await onDeleted(clearLocal)
              setBusy(false)
              setDeleted(true)
            }}
          >
            <Field>
              <FieldLabel htmlFor="acct-confirm">
                Type <b>{name}</b> to confirm
              </FieldLabel>
              <Input id="acct-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
            </Field>
            <LabelledCheckbox label="Also clear my run history on this device" isSelected={clearLocal} onChange={setClearLocal} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onPress={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" isDisabled={busy || typed.trim().toLowerCase() !== name.toLowerCase()}>
                Delete my account
              </Button>
            </div>
          </form>
        )}
      </section>

      {problem && (
        <p className="text-sm text-destructive" role="alert">
          {problem}
        </p>
      )}
      <DialogFooter className="items-center sm:justify-between">
        <span className="flex gap-3.5 text-sm">
          {POLICY_LINKS.map((l) => (
            <a key={l.path} href={l.path} target="_blank" rel="noreferrer" className="text-primary">
              {l.label}
            </a>
          ))}
        </span>
        <Button variant="outline" slot="close">
          Close
        </Button>
      </DialogFooter>
    </AccountDialog>
  )
}
