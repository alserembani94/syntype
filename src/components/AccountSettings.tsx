/**
 * Account & data (docs/leaderboard.md, "Player actions"): the leaderboard
 * name, hiding from the boards, the player's entries (each can be deleted),
 * downloading everything the server keeps, and deleting the account.
 */
import { useEffect, useState } from 'react'
import { LANGUAGES } from '../languages'
import { deleteAccount, deleteEntry, downloadData, fetchEntries, setHidden, signOutEverywhere, type Entry, type Player } from '../lib/account'
import { whenPlayed } from '../lib/board'
import { POLICY_LINKS } from '../seo/policyLinks'
import { Dialog } from './Account'

const PROVIDERS = { github: 'GitHub', google: 'Google' }
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
      <Dialog label="Account deleted" onClose={onClose} className="account-settings">
        <h2>Your account is deleted</h2>
        <p className="dialog-text">
          Your name, scores and replays are off Syntype’s leaderboards and out of its database. Backups that still hold them are gone within 30 days at most.
        </p>
        <p className="dialog-text">
          To finish, you can remove Syntype from the apps connected to your {PROVIDERS[player.provider]} account:{' '}
          <a href={CONNECTED_APPS[player.provider]} target="_blank" rel="noreferrer">
            {PROVIDERS[player.provider]} settings ↗
          </a>
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn accent" data-autofocus onClick={onClose}>
            Done
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog label="Account and data" onClose={onClose} className="account-settings">
      <h2>Account &amp; data</h2>
      <p className="dialog-text">
        Signed in with {PROVIDERS[player.provider]} as <b>{name}</b>.{' '}
        <button type="button" className="inline-link" onClick={onRename}>
          Change name
        </button>
      </p>

      <section className="settings-block" aria-labelledby="acct-boards">
        <h3 id="acct-boards">Leaderboards</h3>
        <label className="switch-row">
          <input
            type="checkbox"
            checked={!hidden}
            onChange={async (e) => {
              // Moves at once; moves back if the server says no.
              const hide = !e.target.checked
              setHiddenNow(hide)
              const r = await setHidden(hide)
              if (r.ok) onPlayer(r.body.player)
              else {
                setHiddenNow(null)
                setProblem(r.error)
              }
            }}
          />
          <span>
            Show me on the leaderboards
            <span className="dialog-note">
              {hidden ? 'Hidden: nobody else sees your runs or name. Your runs are still kept, and you still see your own place.' : 'Your name and best runs are public on each snippet’s board.'}
            </span>
          </span>
        </label>
        {player.hiddenByModerator && <p className="dialog-note problem">A moderator has hidden you from the leaderboards, so you stay hidden whatever this switch says.</p>}
      </section>

      <section className="settings-block" aria-labelledby="acct-entries">
        <h3 id="acct-entries">Your entries</h3>
        {entries === null ? (
          <p className="dialog-note">Loading…</p>
        ) : entries === 'error' ? (
          <p className="dialog-note problem">Your entries couldn’t be loaded.</p>
        ) : entries.length === 0 ? (
          <p className="dialog-note">No runs on the leaderboards yet.</p>
        ) : (
          <ul className="entries">
            {entries.map((e) => (
              <li key={e.runId}>
                <span className="entry-name">
                  {langName(e.language)} · {e.snippet}
                </span>
                <span className="entry-stat">
                  {Math.round(e.wpm)} wpm · {Math.round(e.accuracy)}% · {whenPlayed(e.finishedAt)}
                </span>
                {confirming === e.runId ? (
                  <span className="entry-actions">
                    <button
                      type="button"
                      className="btn danger"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        const r = await deleteEntry(e.runId)
                        setBusy(false)
                        setConfirming(null)
                        if (!r.ok) return setProblem(r.error)
                        setEntries(await fetchEntries().then((x) => x ?? 'error'))
                      }}
                    >
                      Delete
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirming(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" className="inline-link" onClick={() => setConfirming(e.runId)} aria-label={`Delete your ${e.snippet} run`}>
                    delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="dialog-note">Deleting a run takes it off its board. If you have a run on the same snippet with other typing aids, that one takes its place.</p>
      </section>

      <section className="settings-block" aria-labelledby="acct-sessions">
        <h3 id="acct-sessions">Devices</h3>
        <p className="dialog-note">Signs you out on every device and browser where you’re signed in, this one included. Use it if you signed in somewhere you no longer use.</p>
        <div>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const r = await signOutEverywhere()
              setBusy(false)
              if (r.ok) onSignedOut()
              else setProblem(r.error)
            }}
          >
            Sign out everywhere
          </button>
        </div>
      </section>

      <section className="settings-block" aria-labelledby="acct-data">
        <h3 id="acct-data">Your data</h3>
        <p className="dialog-note">A file with everything Syntype keeps about you: your account, best scores, kept keystroke logs, the reports you sent, and reports and moderator actions about you (without other people’s details). Your run history stays on this device (My runs has its own export).</p>
        <div>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              const r = await downloadData()
              if (r) setProblem(r)
            }}
          >
            Download my data
          </button>
        </div>
      </section>

      <section className="settings-block danger-zone" aria-labelledby="acct-delete">
        <h3 id="acct-delete">Delete account</h3>
        {!deleting ? (
          <>
            <p className="dialog-note">Deletes your name, scores and replays from Syntype at once. Reports you sent stay, without your name.</p>
            <div>
              <button type="button" className="btn danger" onClick={() => setDeleting(true)}>
                Delete my account…
              </button>
            </div>
          </>
        ) : (
          <form
            className="delete-form"
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
            <label className="field">
              <span>
                Type <b>{name}</b> to confirm
              </span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={clearLocal} onChange={(e) => setClearLocal(e.target.checked)} />
              <span>Also clear my run history on this device</span>
            </label>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setDeleting(false)}>
                Cancel
              </button>
              <button type="submit" className="btn danger" disabled={busy || typed.trim().toLowerCase() !== name.toLowerCase()}>
                Delete my account
              </button>
            </div>
          </form>
        )}
      </section>

      {problem && (
        <p className="dialog-note problem" role="alert">
          {problem}
        </p>
      )}
      <div className="dialog-actions spread">
        <span className="policy-links">
          {POLICY_LINKS.map((l) => (
            <a key={l.path} href={l.path} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
        </span>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Dialog>
  )
}
