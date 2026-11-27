/**
 * Cloudflare Turnstile, the check that a submitted run comes from a person
 * (docs/leaderboard.md). Loaded only for signed-in players, when they first
 * submit. The widget stays out of sight unless Turnstile needs the player to
 * do something (`appearance: 'interaction-only'`); a token is made on demand
 * (`execution: 'execute'`) and is good for one submission.
 */

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string
  execute(widget: string): void
  reset(widget: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let api: Promise<TurnstileApi> | null = null
function loadApi(): Promise<TurnstileApi> {
  api ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')))
    script.onerror = () => reject(new Error('Turnstile could not be loaded'))
    document.head.append(script)
  }).catch((err) => {
    api = null
    throw err
  })
  return api
}

let widget: { id: string; siteKey: string; waiting: ((r: { token?: string; error?: string }) => void) | null } | null = null

/** A one-use Turnstile token, or an error if Turnstile can't run here. */
export async function turnstileToken(siteKey: string, timeoutMs = 60_000): Promise<string> {
  const t = await loadApi()
  if (!widget || widget.siteKey !== siteKey) {
    const container = document.createElement('div')
    // Hidden unless the widget needs the player to do something (it's empty until then).
    container.className = 'fixed right-4 bottom-4 z-40 empty:hidden'
    document.body.append(container)
    const w: NonNullable<typeof widget> = { id: '', siteKey, waiting: null }
    const settle = (r: { token?: string; error?: string }) => {
      const waiting = w.waiting
      w.waiting = null
      waiting?.(r)
    }
    w.id = t.render(container, {
      sitekey: siteKey,
      execution: 'execute',
      appearance: 'interaction-only',
      action: 'submit-run',
      callback: (token: string) => settle({ token }),
      'error-callback': (code: string) => {
        settle({ error: `Turnstile error ${code}` })
        return true
      },
      'expired-callback': () => settle({ error: 'Turnstile expired' }),
    })
    widget = w
  } else {
    t.reset(widget.id)
  }
  const w = widget
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      w.waiting = null
      reject(new Error('Turnstile took too long'))
    }, timeoutMs)
    w.waiting = (r) => {
      clearTimeout(timer)
      if (r.token) resolve(r.token)
      else reject(new Error(r.error ?? 'Turnstile failed'))
    }
    t.execute(w.id)
  })
}
