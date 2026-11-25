import { describe, expect, it } from 'vitest'
import { flagReason } from './flags'

describe('automatic flags', () => {
  it('a new best far above the player’s own history', () => {
    expect(flagReason({ wpm: 180, rank: 4 }, { count: 5, average: 60 }, 40)).toMatch(/180 WPM, against an average of 60 on their 5 other snippets/)
    // Steady improvement, or a slow typist's jump, isn't flagged.
    expect(flagReason({ wpm: 85, rank: 4 }, { count: 5, average: 70 }, 40)).toBeNull()
    expect(flagReason({ wpm: 70, rank: 4 }, { count: 5, average: 35 }, 40)).toBeNull()
    // Too little history to compare against.
    expect(flagReason({ wpm: 180, rank: 4 }, { count: 2, average: 60 }, 40)).toBeNull()
  })

  it('a newcomer straight to #1 on a board with others on it', () => {
    expect(flagReason({ wpm: 120, rank: 1 }, { count: 0, average: 0 }, 8)).toMatch(/new player straight to #1 of 8, with no other runs/)
    expect(flagReason({ wpm: 120, rank: 1 }, { count: 0, average: 0 }, 3)).toBeNull()
    expect(flagReason({ wpm: 120, rank: 2 }, { count: 0, average: 0 }, 8)).toBeNull()
  })
})
