/** A session cookie for the made-up test player, signed with the checks' throwaway secret (config.ts). */
import { sign } from '../../worker/lib/crypto'
import { FIXED_NOW, TEST_PLAYER, TEST_VARS } from './config'

export const SESSION_COOKIE = 'syntype_session'

export const testSession = () =>
  // Valid for a year from the fixed clock, and from real time, since the Worker checks it against its own clock.
  sign(TEST_VARS.SESSION_SECRET, { k: 'session', p: TEST_PLAYER.id, v: 1, exp: Math.max(Date.parse(FIXED_NOW), Date.now()) + 365 * 86_400_000 })
