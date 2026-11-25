/**
 * The colour themes offered in the theme picker. Their colours are in
 * themes.css, one block per id; "system" has none of its own and follows the
 * computer's light or dark setting.
 */
import { load, save } from '../lib/storage'

/** Picker sections, in the order they're shown. */
export const THEME_SECTIONS = ['Syntype', 'Black', 'Dark', 'Light', 'Retro'] as const
export type ThemeSection = (typeof THEME_SECTIONS)[number]

export interface Theme {
  /** Stable id: the data-syntype-theme value and the saved setting. */
  id: string
  name: string
  section: ThemeSection
  /** Where the colours come from, shown in the picker. */
  credit?: string
  /** For the picker's swatches: the theme ids to show (System shows both of its own). */
  swatches?: string[]
}

export const SYSTEM_THEME = 'system'

export const THEMES: Theme[] = [
  { id: SYSTEM_THEME, name: 'System', section: 'Syntype', credit: 'light or dark, as your computer is', swatches: ['light', 'dark'] },
  { id: 'light', name: 'Syntype Light', section: 'Syntype' },
  { id: 'dark', name: 'Syntype Dark', section: 'Syntype' },
  { id: 'hc-black', name: 'Dark High Contrast', section: 'Black', credit: 'VS Code' },
  { id: 'one-dark-pro', name: 'One Dark Pro', section: 'Dark', credit: 'Binaryify' },
  { id: 'github-light', name: 'GitHub Light', section: 'Light', credit: 'GitHub' },
  { id: 'phosphor', name: 'Green Phosphor', section: 'Retro', credit: 'terminal' },
]

export const getTheme = (id: string): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]

/**
 * Shows a theme on the page. Also used to preview one while the picker is open;
 * index.html applies the saved theme the same way before the first paint.
 */
export function applyTheme(id: string) {
  const root = document.documentElement
  if (id === SYSTEM_THEME) root.removeAttribute('data-syntype-theme')
  else root.setAttribute('data-syntype-theme', id)
}

export const loadTheme = () => getTheme(load('theme', SYSTEM_THEME)).id
export const saveTheme = (id: string) => save('theme', id)
