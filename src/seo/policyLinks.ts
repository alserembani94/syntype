/**
 * The few facts about the policy pages the game itself needs (links in the
 * sign-in and account dialogs), apart from their text in policies.ts, so the
 * game's bundle doesn't carry the pages' text.
 */

/** Who runs Syntype, as the privacy page names them. */
export const OPERATOR = 'Atif'
/** Where players write about their data. Null until there's an address for it; the privacy page is published only with one. */
export const PRIVACY_CONTACT: string | null = 'privacy@vercel.my'

/** The policy pages published now: fair play always, privacy once it has a contact (as policyPages() in policies.ts). */
export const POLICY_LINKS: { path: string; label: string }[] = [
  ...(PRIVACY_CONTACT ? [{ path: '/privacy', label: 'Privacy' }] : []),
  { path: '/fair-play', label: 'Fair play' },
]
