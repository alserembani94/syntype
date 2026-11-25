/**
 * The Worker in front of the site. Static files (the game, the language pages,
 * /runs) are served by Cloudflare directly and never reach this code; only
 * /api/* does (`assets.run_worker_first` in wrangler.jsonc). The API itself is
 * in lib/api.ts (docs/leaderboard.md).
 */
import { handle } from './lib/api'

export default {
  async fetch(request, env): Promise<Response> {
    if (new URL(request.url).pathname.startsWith('/api/')) {
      return handle(request, { db: env.DB, config: env, fetch: (input, init) => fetch(input, init) })
    }
    // Anything else that reaches the Worker is a file request.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
