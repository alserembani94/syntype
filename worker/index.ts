/**
 * The Worker in front of the site. Static files (the game, the language pages,
 * /runs) are served by Cloudflare directly and never reach this code; only
 * /api/* does (`assets.run_worker_first` in wrangler.jsonc). The leaderboard's
 * API grows here (docs/leaderboard.md); for now it answers a health check.
 */
export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/health') {
      // Also proves the database binding works.
      const row = await env.DB.prepare('SELECT 1 AS up').first<{ up: number }>()
      return Response.json({ ok: true, database: row?.up === 1 })
    }
    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    // Anything else that reaches the Worker is a file request.
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
