import { describe, expect, it } from 'vitest'
import { migrateBests, savedLength } from './settings'

describe('saved settings from older versions', () => {
  it('the removed "any" length, or anything unknown, opens as medium', () => {
    expect(savedLength('any')).toBe('medium')
    expect(savedLength(undefined)).toBe('medium')
    expect(savedLength('huge')).toBe('medium')
    for (const l of ['short', 'medium', 'long']) expect(savedLength(l)).toBe(l)
  })

  it('drops bests for the "any" length, which mixed lengths, and keeps the rest', () => {
    const migrated = migrateBests({
      'python:any': 90,
      'python:any:autoclose:autocomplete': 95,
      'python:short': 70,
      'rust:long:autoclose': 60,
    })
    expect(migrated).toEqual({ 'python:short': 70, 'rust:long:autoclose': 60 })
  })

  it('still renames bests saved under the old "intellisense" name', () => {
    expect(migrateBests({ 'go:medium:intellisense': 50 })).toEqual({ 'go:medium:autocomplete': 50 })
  })
})
