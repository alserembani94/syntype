/** The ad spaces and their sizes, fixed up front so nothing moves when real content goes in. */
export const AD_SLOTS = {
  /** On the results screen, under the stats: a leaderboard banner, narrowing on small screens. */
  results: { width: 728, height: 90 },
  /** Either side of the app on wide screens (hidden below 1360px): a wide skyscraper. */
  rail: { width: 160, height: 600 },
} as const

export type AdSlotName = keyof typeof AD_SLOTS
