/**
 * The signed-in player, from the site's API (worker/lib/api.ts). Only on the
 * site itself: the single-file artifact has no server, and there sign-in
 * simply doesn't appear.
 */
export type Provider = 'github' | 'google'

export interface Player {
  id: string
  provider: Provider
  /** Null until the player confirms a leaderboard name. */
  name: string | null
  suggestedName: string
  hidden: boolean
  /** Hidden from the leaderboards by a moderator. */
  hiddenByModerator: boolean
  nameChangedAt: string | null
  /** When the name may change again, if not yet. */
  renameAfter: string | null
}

export type Account = { state: 'loading' } | { state: 'unavailable' } | { state: 'signed-out' } | { state: 'signed-in'; player: Player; turnstileSiteKey?: string }

export async function fetchAccount(): Promise<Account> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    if (!res.ok || !res.headers.get('Content-Type')?.includes('application/json')) return { state: 'unavailable' }
    const body = (await res.json()) as { signedIn: boolean; player?: Player; turnstileSiteKey?: string }
    return body.signedIn && body.player ? { state: 'signed-in', player: body.player, turnstileSiteKey: body.turnstileSiteKey } : { state: 'signed-out' }
  } catch {
    return { state: 'unavailable' }
  }
}

/** Remembered across the trip to GitHub or Google, so the name step opens on return. */
const JUST_SIGNED_IN = 'syntype:signing-in'

/** Starts signing in; the player comes back to the page they were on. */
export function signIn(provider: Provider) {
  try {
    sessionStorage.setItem(JUST_SIGNED_IN, '1')
  } catch {
    /* no storage: the name step can still be opened from the header */
  }
  location.assign(`/api/auth/${provider}/start?return=${encodeURIComponent(location.pathname + location.search)}`)
}

/** Whether this page load is the return from signing in (asked once). */
export function justSignedIn(): boolean {
  try {
    const yes = sessionStorage.getItem(JUST_SIGNED_IN) === '1'
    sessionStorage.removeItem(JUST_SIGNED_IN)
    return yes
  } catch {
    return false
  }
}

/** A sign-in that didn't complete, as the server reports it (?signin=…), in words; and removed from the address. */
export function signInProblem(): string | null {
  const q = new URLSearchParams(location.search)
  const code = q.get('signin')
  if (!code) return null
  q.delete('signin')
  history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : '') + location.hash)
  return (
    {
      cancelled: 'Sign-in was cancelled.',
      expired: 'That sign-in took too long or was started in another tab. Please try again.',
      refused: 'The sign-in was refused. Please try again.',
    }[code] ?? 'Signing in didn’t work this time. Please try again.'
  )
}

export async function saveName(name: string): Promise<{ player: Player } | { error: string }> {
  try {
    const res = await fetch('/api/me/name', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const body = (await res.json()) as { player?: Player; error?: string }
    return res.ok && body.player ? { player: body.player } : { error: body.error ?? 'That didn’t work. Please try again.' }
  } catch {
    return { error: 'Couldn’t reach Syntype. Check your connection and try again.' }
  }
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/signout', { method: 'POST', credentials: 'same-origin' }).catch(() => {})
}

/** The rules the server applies (worker/lib/names.ts), checked as the player types, for a quick hint. */
export function nameHint(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 3) return 'At least 3 characters.'
  if (name.length > 24) return 'At most 24 characters.'
  if (!/^[A-Za-z0-9 _-]+$/.test(name)) return 'Letters, numbers, spaces, - and _ only.'
  return null
}
