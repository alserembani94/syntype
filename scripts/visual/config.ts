/**
 * The visual, accessibility and speed checks' settings (docs: scripts/visual/README.md).
 * Everything here is fixed so two runs on the same code give the same pictures.
 */
import { THEMES, SYSTEM_THEME } from '../../src/themes'

/** The moment every capture happens at: the fixtures' dates are relative to it. */
export const FIXED_NOW = '2026-11-25T12:00:00.000Z'

/** The local Worker. Port 8787 is the one the API accepts requests from in development. */
export const PORT = 8787
export const BASE = `http://localhost:${PORT}`

/**
 * Throwaway values for the local server only, passed with --var, so the checks
 * never read the real secrets in .dev.vars. Turnstile's is Cloudflare's
 * always-pass test key; the admin email is the local-only bypass.
 */
export const TEST_VARS = {
  SESSION_SECRET: 'visual-checks-only-not-a-real-secret',
  GITHUB_CLIENT_SECRET: 'visual-checks',
  GOOGLE_CLIENT_SECRET: 'visual-checks',
  TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  TURNSTILE_SITE_KEY: '1x00000000000000000000BB',
  ADMIN_DEV_EMAIL: 'admin@localhost',
}

/** The made-up signed-in player (scripts/visual/fixtures/seed.sql). */
export const TEST_PLAYER = { id: 'ptest', name: 'Local Tester' }

export const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
} as const
export type ViewportName = keyof typeof VIEWPORTS

/** Every chosen theme. System isn't captured: its blocks must equal Light and Dark (rule T1). */
export const THEME_IDS = THEMES.map((t) => t.id).filter((id) => id !== SYSTEM_THEME)

/** Where captures go: .visual/<label>/ (ignored by git). */
export const OUT_DIR = '.visual'
