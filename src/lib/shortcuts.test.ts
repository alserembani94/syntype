import { describe, expect, it } from 'vitest'
import { shortcut, type KeyLike } from './shortcuts'

const press = (key: string, mods: Partial<Omit<KeyLike, 'key'>> = {}): KeyLike => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

describe('shortcuts', () => {
  it('Ctrl or ⌘ + Enter loads a new snippet; Enter alone is typing', () => {
    expect(shortcut(press('Enter', { ctrlKey: true }), false)).toBe('newSnippet')
    expect(shortcut(press('Enter', { metaKey: true }), false)).toBe('newSnippet')
    expect(shortcut(press('Enter'), false)).toBeNull()
    expect(shortcut(press('Enter', { shiftKey: true }), false)).toBeNull()
  })

  it('Esc is never a shortcut, so it can only close things', () => {
    expect(shortcut(press('Escape'), false)).toBeNull()
    expect(shortcut(press('Escape', { ctrlKey: true }), false)).toBeNull()
  })

  it('Ctrl or ⌘ + Shift + L changes language, whatever case the key reports', () => {
    expect(shortcut(press('L', { ctrlKey: true, shiftKey: true }), false)).toBe('language')
    expect(shortcut(press('l', { metaKey: true, shiftKey: true }), false)).toBe('language')
    expect(shortcut(press('l', { ctrlKey: true }), false)).toBeNull()
    expect(shortcut(press('L', { shiftKey: true }), false)).toBeNull()
  })

  it('Ctrl or ⌘ + K, then T changes theme; any other second key cancels', () => {
    expect(shortcut(press('k', { ctrlKey: true }), false)).toBe('chordStart')
    expect(shortcut(press('t'), true)).toBe('theme')
    expect(shortcut(press('T', { shiftKey: true }), true)).toBe('theme')
    expect(shortcut(press('x'), true)).toBe('chordCancel')
    expect(shortcut(press('Escape'), true)).toBe('chordCancel')
    // Releasing or pressing a modifier on the way to the second key keeps waiting.
    expect(shortcut(press('Control', { ctrlKey: true }), true)).toBeNull()
    expect(shortcut(press('Shift', { shiftKey: true }), true)).toBeNull()
  })

  it('leaves Alt combinations and plain letters alone', () => {
    expect(shortcut(press('Enter', { ctrlKey: true, altKey: true }), false)).toBeNull()
    expect(shortcut(press('k'), false)).toBeNull()
    expect(shortcut(press('t'), false)).toBeNull()
  })
})
