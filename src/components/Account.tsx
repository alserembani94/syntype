import { useEffect, useRef, useState } from 'react'
import { justSignedIn, nameHint, saveName, signIn, signInProblem, signOut, fetchAccount, type Account as AccountState, type Player, type Provider } from '../lib/account'

interface Props {
  /** Only on the site itself; the single-file artifact has no server. */
  available: boolean
  /** A dialog or menu is open: the game pauses and ignores keys. */
  onOpenChange: (open: boolean) => void
  onMyRuns: () => void
}

type Open = null | 'signin' | 'name' | 'menu'

const PROVIDER_NAMES: Record<Provider, string> = { github: 'GitHub', google: 'Google' }

/** Sign in, the leaderboard name step, and the account menu, in the header. */
export function Account({ available, onOpenChange, onMyRuns }: Props) {
  const [account, setAccount] = useState<AccountState>({ state: 'loading' })
  const [open, setOpenState] = useState<Open>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const setOpen = (o: Open) => {
    setOpenState(o)
    onOpenChange(o !== null)
  }
  const setOpenRef = useRef(setOpen)
  useEffect(() => {
    setOpenRef.current = setOpen
  })

  useEffect(() => {
    if (!available) return
    const problem = signInProblem()
    const returning = justSignedIn()
    let live = true
    fetchAccount().then((a) => {
      if (!live) return
      setAccount(a)
      if (problem) setNotice(problem)
      // Back from a first sign-in: confirm a leaderboard name straight away.
      else if (returning && a.state === 'signed-in' && !a.player.name) setOpenRef.current('name')
    })
    return () => {
      live = false
    }
  }, [available])

  if (!available || account.state === 'loading' || account.state === 'unavailable') return null

  const player = account.state === 'signed-in' ? account.player : null
  return (
    <>
      {player ? (
        <button
          type="button"
          className={`account-button${player.name ? '' : ' attention'}`}
          aria-haspopup="dialog"
          onClick={() => setOpen(player.name ? 'menu' : 'name')}
          title={player.name ? `Signed in with ${PROVIDER_NAMES[player.provider]}` : 'Choose the name shown on leaderboards'}
        >
          <span className="avatar" aria-hidden="true">
            {(player.name ?? player.suggestedName).slice(0, 1).toUpperCase()}
          </span>
          <span className="account-label">{player.name ?? 'Choose your name'}</span>
        </button>
      ) : (
        <button type="button" className="account-button" aria-haspopup="dialog" onClick={() => setOpen('signin')}>
          Sign in
        </button>
      )}

      {notice && (
        <div className="toast" role="status">
          {notice}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}

      {open === 'signin' && <SignInDialog onClose={() => setOpen(null)} />}
      {open === 'name' && player && (
        <NameDialog
          player={player}
          onClose={() => setOpen(null)}
          onSaved={(p) => {
            setAccount({ state: 'signed-in', player: p })
            setOpen(null)
          }}
        />
      )}
      {open === 'menu' && player && (
        <AccountMenu
          player={player}
          onClose={() => setOpen(null)}
          onRename={() => setOpen('name')}
          onMyRuns={() => {
            setOpen(null)
            onMyRuns()
          }}
          onSignOut={async () => {
            await signOut()
            setAccount({ state: 'signed-out' })
            setOpen(null)
          }}
        />
      )}
    </>
  )
}

/** A modal panel: Esc or a click outside closes it, and focus starts inside. */
function Dialog({ label, onClose, children, className = '' }: { label: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus], input, button')?.focus()
  }, [])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

const GITHUB_ICON = 'M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.7.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z'

function SignInDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog label="Sign in" onClose={onClose}>
      <h2>Sign in to Syntype</h2>
      <p className="dialog-text">To put your runs on the leaderboards. Only your public profile is used: no email, and nothing is posted anywhere.</p>
      <div className="signin-options">
        <button type="button" className="signin-option" data-autofocus onClick={() => signIn('github')}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d={GITHUB_ICON} fill="currentColor" />
          </svg>
          Continue with GitHub
        </button>
        <button type="button" className="signin-option" onClick={() => signIn('google')}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="#4285F4" />
            <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
            <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14z" fill="#FBBC05" />
            <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>
      </div>
      <p className="dialog-note">Your run history stays on this device either way.</p>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose}>
          Not now
        </button>
      </div>
    </Dialog>
  )
}

function NameDialog({ player, onClose, onSaved }: { player: Player; onClose: () => void; onSaved: (p: Player) => void }) {
  const [name, setName] = useState(player.name ?? player.suggestedName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Worked out once, when the dialog opens.
  const [waitUntil] = useState(() => (player.renameAfter && Date.parse(player.renameAfter) > Date.now() ? new Date(player.renameAfter) : null))
  const hint = nameHint(name)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hint || saving) return
    setSaving(true)
    const result = await saveName(name)
    setSaving(false)
    if ('error' in result) setError(result.error)
    else onSaved(result.player)
  }
  return (
    <Dialog label="Your leaderboard name" onClose={onClose}>
      <form onSubmit={submit}>
        <h2>{player.name ? 'Change your name' : 'Your leaderboard name'}</h2>
        <p className="dialog-text">
          {player.name
            ? 'This is the name shown next to your runs on the leaderboards.'
            : 'Shown next to your runs on the leaderboards. Until you confirm one, your runs aren’t submitted.'}
        </p>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!(hint || error)}
            aria-describedby="name-help"
            disabled={!!waitUntil}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
          />
        </label>
        <p id="name-help" className={`dialog-note${error || (hint && name.trim()) ? ' problem' : ''}`} role={error ? 'alert' : undefined}>
          {waitUntil
            ? `You can change your name again after ${waitUntil.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
            : (error ?? hint ?? '3–24 characters: letters, numbers, spaces, - and _. You can change it once a week.')}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onClose}>
            {player.name ? 'Cancel' : 'Later'}
          </button>
          <button type="submit" className="btn accent" disabled={!!hint || saving || !!waitUntil}>
            {saving ? 'Saving…' : player.name ? 'Save' : 'Continue'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function AccountMenu({
  player,
  onClose,
  onRename,
  onMyRuns,
  onSignOut,
}: {
  player: Player
  onClose: () => void
  onRename: () => void
  onMyRuns: () => void
  onSignOut: () => void
}) {
  return (
    <Dialog label="Account" onClose={onClose} className="account-menu">
      <p className="menu-who">
        <strong>{player.name}</strong>
        <span>signed in with {PROVIDER_NAMES[player.provider]}</span>
      </p>
      <button type="button" className="menu-item" data-autofocus onClick={onRename}>
        Change name
      </button>
      <button type="button" className="menu-item" onClick={onMyRuns}>
        My runs
      </button>
      <button type="button" className="menu-item" onClick={onSignOut}>
        Sign out
      </button>
    </Dialog>
  )
}
