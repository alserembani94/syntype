import { describe, expect, it } from 'vitest'
import { BUDGET, overBudget } from './size-budget.mjs'

describe('first-load budget', () => {
  it('passes at or under every limit', () => {
    expect(overBudget({ js: BUDGET.js, css: BUDGET.css - 1 })).toEqual([])
  })

  it('names each part over its limit and by how much', () => {
    expect(overBudget({ js: 150.25, css: 25 }, { js: 145, css: 24 })).toEqual([
      'First-load JavaScript is 150.25 KB gzip, over its 145 KB budget by 5.3 KB.',
      'First-load CSS is 25 KB gzip, over its 24 KB budget by 1 KB.',
    ])
  })

  it('reports only the part that grew', () => {
    expect(overBudget({ js: 146, css: 20 }, { js: 145, css: 24 })).toHaveLength(1)
  })
})
