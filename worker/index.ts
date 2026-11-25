/**
 * The Worker in front of the site. Static files (the game, the language pages,
 * /runs) are served by Cloudflare directly and never reach this code; only
 * /api/* does (`assets.run_worker_first` in wrangler.jsonc). The API itself is
 * in lib/api.ts (docs/leaderboard.md).
 */
import { handle } from './lib/api'
import { deleteInactive } from './lib/account'

/** Answers that are the same for everyone (boards and replays), kept at the edge for a minute. */
const isShared = (request: Request, url: URL) =>
  request.method === 'GET' && (url.pathname === '/api/boards' || /^\/api\/boards\/[0-9a-f]{64}$/.test(url.pathname) || url.pathname.startsWith('/api/replays/'))

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      // The Cache API: shared answers come from this data centre's cache for 60 seconds.
      const cache = isShared(request, url) ? caches.default : null
      const key = cache ? new Request(url.toString()) : null
      const hit = cache && key ? await cache.match(key) : undefined
      if (hit) return hit
      const response = await handle(request, {
        db: env.DB,
        config: env,
        fetch: (input, init) => fetch(input, init),
        assets: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
      })
      if (cache && key && response.ok) ctx.waitUntil(cache.put(key, response.clone()))
      return response
    }
    // Anything else that reaches the Worker is a file request.
    return env.ASSETS.fetch(request)
  },
  // Daily (triggers.crons in wrangler.jsonc): delete accounts unused for two years.
  async scheduled(_controller, env) {
    const deleted = await deleteInactive(env.DB, new Date())
    if (deleted) console.log(`Deleted ${deleted} inactive accounts`)
  },
} satisfies ExportedHandler<Env>
