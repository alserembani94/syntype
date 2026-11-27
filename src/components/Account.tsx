import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { AccountAction } from '@/components/composites/account-menu'
import { Tip } from '@/components/composites/tip'
import { useToast } from '@/components/composites/use-toast'
import { Button } from '@/components/ui/button'
import { PROVIDER_NAMES } from '../lib/labels'
import type { History } from '../lib/history'

// Loaded when needed, keeping React Aria's overlay and menu code out of the first load:
// the dialogs when one opens, the menu once the player is signed in.
const AccountSettings = lazy(() => import('./AccountSettings').then((m) => ({ default: m.AccountSettings })))
const SignInDialog = lazy(() => import('./AccountDialogs').then((m) => ({ default: m.SignInDialog })))
const NameDialog = lazy(() => import('./AccountDialogs').then((m) => ({ default: m.NameDialog })))
const AccountMenu = lazy(() => import('@/components/composites/account-menu').then((m) => ({ default: m.AccountMenu })))
import { justSignedIn, signInProblem, signOut, fetchAccount, type Account as AccountState, type Player } from '../lib/account'

interface Props {
  /** Only on the site itself; the single-file artifact has no server. */
  available: boolean
  /** A dialog or menu is open: the game pauses and ignores keys. */
  onOpenChange: (open: boolean) => void
  onMyRuns: () => void
  /** The signed-in player as it changes (null when signed out), and Turnstile's sitekey for submitting runs. */
  onPlayer?: (player: Player | null, turnstileSiteKey: string | null) => void
  /** This device's run history, cleared if the player deletes their account and asks to. */
  history?: Promise<History | null>
}

type Open = null | 'signin' | 'name' | 'settings'


/** Sign in, the leaderboard name step, and the account menu, in the header. */
export function Account({ available, onOpenChange, onMyRuns, onPlayer, history }: Props) {
  const [account, setAccount] = useState<AccountState>({ state: 'loading' })
  const [open, setOpenState] = useState<Open>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const toast = useToast()
  // The player the Account & data dialog is about; kept after the account is deleted, for its last step.
  const [settingsFor, setSettingsFor] = useState<Player | null>(null)
  const setOpen = (o: Open) => {
    setOpenState(o)
    onOpenChange(o !== null || menuOpen)
  }
  const setMenu = (m: boolean) => {
    setMenuOpen(m)
    onOpenChange(m || open !== null)
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
      if (problem) toast.show(problem, { tone: 'error' })
      // Back from a first sign-in: confirm a leaderboard name straight away.
      else if (returning && a.state === 'signed-in' && !a.player.name) setOpenRef.current('name')
    })
    return () => {
      live = false
    }
  }, [available, toast])

  const onPlayerRef = useRef(onPlayer)
  useEffect(() => {
    onPlayerRef.current = onPlayer
  })
  const signedInPlayer = account.state === 'signed-in' ? account.player : null
  const siteKey = account.state === 'signed-in' ? (account.turnstileSiteKey ?? null) : null
  useEffect(() => onPlayerRef.current?.(signedInPlayer, siteKey), [signedInPlayer, siteKey])

  if (!available || account.state === 'loading' || account.state === 'unavailable') return null

  const player = account.state === 'signed-in' ? account.player : null
  const onAction = async (action: AccountAction) => {
    if (!player) return
    if (action === 'rename') setOpen('name')
    else if (action === 'settings') {
      setSettingsFor(player)
      setOpen('settings')
    } else if (action === 'runs') onMyRuns()
    else {
      await signOut()
      setAccount({ state: 'signed-out' })
    }
  }
  return (
    <>
      {player?.name ? (
        // Until the menu's code arrives, the same button, inert.
        <Suspense
          fallback={
            <Button variant="outline" className="max-sm:px-2" isDisabled>
              <Avatar name={player.name} label={player.name} account />
            </Button>
          }
        >
          <AccountMenu
            name={player.name}
            provider={PROVIDER_NAMES[player.provider]}
            trigger={<Avatar name={player.name} label={player.name} account />}
              onAction={onAction}
            onOpenChange={setMenu}
            className="max-sm:px-2"
          />
        </Suspense>
      ) : player ? (
        <Tip label="Choose the name shown on leaderboards">
          <Button variant="outline" className="border-primary bg-accent text-primary max-sm:px-2" aria-haspopup="dialog" onPress={() => setOpen('name')}>
            <Avatar name={player.suggestedName} label="Choose your name" />
          </Button>
        </Tip>
      ) : (
        <Button variant="outline" aria-haspopup="dialog" onPress={() => setOpen('signin')}>
          Sign in
        </Button>
      )}

      <Suspense fallback={null}>
        {open === 'signin' && <SignInDialog onClose={() => setOpen(null)} />}
        {open === 'name' && player && (
          <NameDialog
            player={player}
            onClose={() => setOpen(null)}
            onSaved={(p) => {
              setAccount((a) => ({ state: 'signed-in', player: p, turnstileSiteKey: a.state === 'signed-in' ? a.turnstileSiteKey : undefined }))
              setOpen(null)
            }}
          />
        )}
      </Suspense>
      {open === 'settings' && (player ?? settingsFor) && (
        <Suspense fallback={null}>
          <AccountSettings
            player={(player ?? settingsFor)!}
            onClose={() => setOpen(null)}
            onRename={() => setOpen('name')}
            onPlayer={(p) => setAccount((a) => (a.state === 'signed-in' ? { ...a, player: p } : a))}
            onDeleted={async (clearLocal) => {
              if (clearLocal) await (await history)?.clear()
              setAccount({ state: 'signed-out' })
            }}
            onSignedOut={() => {
              setAccount({ state: 'signed-out' })
              setOpen(null)
              toast.show('Signed out on every device.')
            }}
          />
        </Suspense>
      )}
    </>
  )
}

/** The initial in a circle, then the name (hidden on phones, where the button shows only the initial). */
function Avatar({ name, label, account }: { name: string; label: string; account?: boolean }) {
  return (
    <>
      <span className="grid size-5 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="max-w-40 truncate max-sm:sr-only">{label}</span>
      {account && <span className="sr-only">, account</span>}
    </>
  )
}

