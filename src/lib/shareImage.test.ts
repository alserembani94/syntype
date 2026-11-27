import { describe, expect, test } from 'vitest'
import { shareAlt, shareFileName, shareText, type ShareScore } from './shareImage'

const score: ShareScore = {
  wpm: 86.6,
  accuracy: 97.6,
  language: 'C#',
  languageId: 'csharp',
  length: 'long',
  snippet: 'OrderService.cs',
  aids: ['auto-close', 'autocomplete'],
  isBest: false,
  date: new Date(2026, 10, 27),
}

describe('share image text', () => {
  test('the post text has the rounded score, the language and its page', () => {
    expect(shareText(score)).toBe('87 WPM at 98% accuracy typing C# on Syntype https://syntype.vercel.my/csharp')
  })

  test('the file is named by language and speed', () => {
    expect(shareFileName(score)).toBe('syntype-csharp-87wpm.png')
  })

  test('the alt text says everything the image shows', () => {
    expect(shareAlt(score)).toBe(
      'Syntype score: 87 words per minute at 98% accuracy. C#, long: OrderService.cs, with auto-close, autocomplete. 27 Nov 2026.',
    )
    expect(shareAlt({ ...score, aids: [], isBest: true })).toBe(
      'Syntype score: 87 words per minute at 98% accuracy, a new personal best. C#, long: OrderService.cs, with no typing aids. 27 Nov 2026.',
    )
  })
})
