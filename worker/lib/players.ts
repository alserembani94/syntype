/** Players: created on first sign-in, named once they confirm a name. */
import type { Db } from './db'
import type { Profile, Provider } from './oauth'
import type { Player } from '../../src/lib/apiTypes'
import { nameKey, nameProblem, RENAME_EVERY_MS, suggestName, tidyName } from './names'

export interface PlayerRow {
  id: string
  provider: Provider
  provider_id: string
  name: string | null
  suggested_name: string
  name_changed_at: string | null
  /** Hidden by the player themselves. */
  hidden: number
  /** Hidden by the admin; only the admin can show them again. */
  moderator_hidden: number
  session_version: number
  created_at: string
  last_seen_at: string
}

/** What the game is told about the signed-in player (GET /api/me). */
export function publicPlayer(p: PlayerRow): Player {
  return {
    id: p.id,
    provider: p.provider,
    name: p.name,
    suggestedName: p.suggested_name,
    hidden: p.hidden === 1,
    hiddenByModerator: p.moderator_hidden === 1,
    nameChangedAt: p.name_changed_at,
    /** When they may rename next, if they can't now. */
    renameAfter: p.name && p.name_changed_at ? new Date(Date.parse(p.name_changed_at) + RENAME_EVERY_MS).toISOString() : null,
  }
}

export const getPlayer = (db: Db, id: string) => db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<PlayerRow>()

const randomDigits = () => String(100 + Math.floor(Math.random() * 900))

/** The player for this provider account, created on their first sign-in. */
export async function playerFor(db: Db, provider: Provider, profile: Profile, now: Date): Promise<PlayerRow> {
  const found = await db.prepare('SELECT * FROM players WHERE provider = ? AND provider_id = ?').bind(provider, profile.providerId).first<PlayerRow>()
  if (found) return found
  const id = crypto.randomUUID()
  const at = now.toISOString()
  await db
    .prepare('INSERT INTO players (id, provider, provider_id, suggested_name, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (provider, provider_id) DO NOTHING')
    .bind(id, provider, profile.providerId, suggestName(profile, randomDigits), at, at)
    .run()
  // Re-read: a simultaneous first sign-in may have created the row first.
  return (await db.prepare('SELECT * FROM players WHERE provider = ? AND provider_id = ?').bind(provider, profile.providerId).first<PlayerRow>())!
}

/** Notes the player was here, at most once a day so it costs few writes. */
export async function touch(db: Db, p: PlayerRow, now: Date): Promise<void> {
  if (now.getTime() - Date.parse(p.last_seen_at) < 24 * 60 * 60 * 1000) return
  await db.prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').bind(now.toISOString(), p.id).run()
}

export type NameResult = { ok: true; player: PlayerRow } | { ok: false; status: number; error: string }

/** Sets (or changes) the player's name, by the rules in names.ts. */
export async function setName(db: Db, p: PlayerRow, raw: unknown, now: Date): Promise<NameResult> {
  if (typeof raw !== 'string') return { ok: false, status: 400, error: 'Send a name.' }
  const name = tidyName(raw)
  const problem = nameProblem(name)
  if (problem) return { ok: false, status: 400, error: problem }
  if (p.name === name) return { ok: true, player: p }
  if (p.name && p.name_changed_at && now.getTime() - Date.parse(p.name_changed_at) < RENAME_EVERY_MS) {
    const after = new Date(Date.parse(p.name_changed_at) + RENAME_EVERY_MS)
    return { ok: false, status: 429, error: `You can change your name again after ${after.toUTCString().slice(5, 16)}.` }
  }
  // Only a change of name starts the weekly wait; confirming the first one doesn't.
  const changedAt = p.name ? now.toISOString() : null
  try {
    await db.prepare('UPDATE players SET name = ?, name_key = ?, name_changed_at = ? WHERE id = ?').bind(name, nameKey(name), changedAt, p.id).run()
  } catch (err) {
    if (/UNIQUE/i.test(String(err))) return { ok: false, status: 409, error: 'That name is taken. Try another.' }
    throw err
  }
  return { ok: true, player: (await getPlayer(db, p.id))! }
}
