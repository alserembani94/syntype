import { describe, expect, it } from 'vitest'
import { duration, speed, whenPlayed } from './format'

describe('words for time', () => {
  it('durations', () => {
    expect(duration(45)).toBe('45s')
    expect(duration(12 * 60 + 5)).toBe('12m')
    expect(duration(102 * 60)).toBe('1h 42m')
  })

  it('when a run was played, by calendar day', () => {
    const now = new Date(2026, 10, 25, 9, 0)
    expect(whenPlayed(new Date(2026, 10, 25, 1, 0).toISOString(), now)).toBe('today')
    expect(whenPlayed(new Date(2026, 10, 24, 23, 59).toISOString(), now)).toBe('yesterday')
    expect(whenPlayed(new Date(2026, 10, 22, 12, 0).toISOString(), now)).toBe('3 days ago')
    expect(whenPlayed(new Date(2026, 10, 16, 12, 0).toISOString(), now)).toBe('last week')
    expect(whenPlayed(new Date(2026, 9, 1, 12, 0).toISOString(), now)).not.toMatch(/ago|week|day/)
  })

  it('speed and accuracy', () => {
    expect(speed({ wpm: 71.6, accuracy: 97.5 })).toBe('72 wpm · 98%')
  })
})
