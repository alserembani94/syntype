/**
 * The signed-in player, from the site's API (worker/lib/api.ts). Only on the
 * site itself: the single-file artifact has no server, and there sign-in
 * simply doesn't appear.
 */
import type { Entry, Player, Provider } from './apiTypes'
import { nameShapeProblem } from './nameRules'
import { api, OFFLINE, TRY_AGAIN } from './http'

export type { Entry, Player, Provider }

export type Account = { state: 'loading' } | { state: 'unavailable' } | { state: 'signed-out' } | { state: 'signed-in'; player: Player; turnstileSiteKey?: string }

export async function fetchAccount(): Promise<Account> {
  // The artifact has no server: its page answers instead, which isn't JSON.
  const r = await api<{ signedIn: boolean; player?: Player; turnstileSiteKey?: string }>('/api/me')
  if (!r.ok) return { state: 'unavailable' }
  const { player, turnstileSiteKey } = r.body
  return r.body.signedIn && player ? { state: 'signed-in', player, turnstileSiteKey } : { state: 'signed-out' }
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
  const r = await api<{ player: Player }>('/api/me/name', { body: { name } })
  return r.ok ? { player: r.body.player } : { error: r.error }
}

export async function signOut(): Promise<void> {
  await api('/api/auth/signout', { method: 'POST' })
}

/** The name's shape, checked as the player types for a quick hint; the server also turns away reserved and offensive names. */
export const nameHint = nameShapeProblem

// ——— The player's own data (worker/lib/account.ts) ———

const post = <T>(path: string, body: unknown) => api<T>(path, { body })

/** Hides the player from every leaderboard, or shows them again. */
export const setHidden = (hidden: boolean) => post<{ player: Player }>('/api/me/hide', { hidden })

export const fetchEntries = (): Promise<Entry[] | null> => api<{ entries: Entry[] }>('/api/me/runs').then((r) => (r.ok ? r.body.entries : null))

export const deleteEntry = (runId: string) => post<{ ok: true }>(`/api/me/runs/${encodeURIComponent(runId)}/delete`, {})

/** Saves everything the server keeps about the player as a file. */
export async function downloadData(): Promise<string | null> {
  try {
    const res = await fetch('/api/me/data', { credentials: 'same-origin' })
    if (!res.ok) return TRY_AGAIN
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `syntype-account-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return null
  } catch {
    return OFFLINE
  }
}

/** Deletes the account; `confirm` is the player's name, typed to make sure. */
export const deleteAccount = (confirm: string) => post<{ deleted: true }>('/api/me/delete', { confirm })

/** Ends every session the player has, on every device, this one included. */
export const signOutEverywhere = () => post<{ signedIn: false }>('/api/me/signout-everywhere', {})
