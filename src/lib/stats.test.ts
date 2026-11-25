import { describe, expect, it } from 'vitest'
import { consistency, type Sample } from './stats'

const steady = (raws: number[]): Sample[] => raws.map((raw, i) => ({ t: i + 1, raw, wpm: raw, errors: 0 }))

describe('consistency', () => {
  it('is 100% when every second is typed at the same pace', () => {
    expect(consistency(steady([60, 60, 60, 60]))).toBe(100)
  })

  it('drops as the pace varies', () => {
    const even = consistency(steady([60, 65, 55, 60]))!
    const bumpy = consistency(steady([20, 100, 30, 90]))!
    expect(even).toBeGreaterThan(bumpy)
    expect(bumpy).toBeGreaterThanOrEqual(0)
  })

  it('needs at least 3 full seconds', () => {
    expect(consistency(steady([60, 60]))).toBeNull()
  })

  it('ignores the final partial second', () => {
    const s = [...steady([60, 60, 60]), { t: 3.2, raw: 5, wpm: 60, errors: 0 }]
    expect(consistency(s)).toBe(100)
  })
})
