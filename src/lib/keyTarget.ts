/**
 * Does the focused control use this key itself? The app listens for keys on
 * the whole page so you can type from anywhere; it asks this first and steps
 * aside when the answer is yes (design system step 10). Decided from the
 * control's role, so React Aria's controls and our own plain ones answer alike:
 *
 * - text fields, menus, list boxes, grids and dialogs: every key
 * - sliders: arrows, Home, End, Page Up and Page Down
 * - toggle groups, radio groups, tabs and toolbars: arrows, Home and End
 *   (plus Enter and Space on the item itself)
 * - buttons, links, switches, checkboxes and toggles: Enter and Space
 *
 * Tab belongs to every control except the editor's own hidden input
 * (data-typing-input), which is the app's to handle: there Tab types an indent.
 * Anything else falls through: a letter typed while a chip is focused still
 * types into the editor.
 */
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
const PRESS = ['Enter', ' ']

/** Roles (or elements) that take every key. */
const ALL_KEYS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="grid"], [role="combobox"], [role="searchbox"], [role="textbox"], input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select, [contenteditable="true"]'
/** Roles whose items move with the arrow keys. */
const COMPOSITE = '[role="radiogroup"], [role="tablist"], [role="toolbar"], [role="group"][data-slot="toggle-group"]'
const SLIDER = '[role="slider"], input[type="range"], [data-slot="slider"]'
const PRESSABLE = 'button, a[href], [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="radio"]'

export function ownsKey(e: Pick<KeyboardEvent, 'key' | 'target'>): boolean {
  const el = e.target
  if (!(el instanceof Element)) return false
  // The editor's hidden input is typed into by the app itself.
  if (el.closest('[data-typing-input]')) return false
  // Tab moves focus from any other control (only in the editor does it type an indent):
  // taking it would trap keyboard users on the control (WCAG 2.1.2).
  if (e.key === 'Tab') return el !== el.ownerDocument.body
  if (el.closest(ALL_KEYS)) return true
  if (el.closest(SLIDER)) return [...ARROWS, 'PageUp', 'PageDown'].includes(e.key)
  if (el.closest(COMPOSITE) && ARROWS.includes(e.key)) return true
  return PRESS.includes(e.key) && !!el.closest(PRESSABLE)
}
