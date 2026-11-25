/**
 * A preview of the leaderboards with sample data, as one self-contained page
 * (scripts/build-preview.mjs): the real LeaderboardView, with the API answered
 * in the page instead of by the server. For reviewing the design; nothing here
 * is real or sent anywhere.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../themes/themes.css'
import '../index.css'
import { LANGUAGES } from '../languages'
import { buildSample, replayFor } from './sample'
import { Preview } from './Preview'

const sample = buildSample(LANGUAGES)

// The leaderboard API, answered from the sample.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'https://preview.local')
  const data = await sample
  await new Promise((r) => setTimeout(r, 120))
  if (url.pathname === '/api/boards') return json(data.languages.get(url.searchParams.get('lang') ?? '') ?? { snippets: [], archived: [] })
  const board = url.pathname.match(/^\/api\/boards\/([0-9a-f]{64})(\/me)?$/)
  if (board) {
    const b = data.boards.get(board[1])
    const aids = url.searchParams.get('aids') ?? 'any'
    if (board[2]) {
      const mine = data.mine.get(board[1])
      return json({ signedIn: true, row: mine && (aids === 'any' || mine.aids === aids) ? mine : null })
    }
    if (!b) return json({ error: 'No such board.' }, 404)
    const rows = (aids === 'any' ? b.rows : b.rows.filter((r) => r.aids === aids)).slice(0, 15).map((r, i) => ({ ...r, rank: i + 1 }))
    return json({ ...b, aids, rows })
  }
  const replay = url.pathname.match(/^\/api\/(?:admin\/)?replays\/(.+)$/)
  if (replay) {
    const r = replayFor(data, decodeURIComponent(replay[1]))
    return r ? json(r) : json({ error: 'That run can’t be replayed.' }, 404)
  }
  if (url.pathname === '/api/reports' && init?.method === 'POST') return json({ ok: true }, 201)
  return json({ error: 'Not in the preview.' }, 404)
}

// Follow the viewer's light or dark setting with Syntype's own two themes.
const root = document.documentElement
const followTheme = () => {
  const t = root.getAttribute('data-theme')
  if (t === 'dark' || t === 'light') root.setAttribute('data-syntype-theme', t)
  else root.removeAttribute('data-syntype-theme')
}
followTheme()
new MutationObserver(followTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
)
