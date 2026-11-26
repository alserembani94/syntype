/** What the gallery shows, in order. */
import { SYSTEM_THEME, THEMES } from '@/themes'

/** The themes to compare (System is light or dark, already in the list). */
export const GALLERY_THEMES = THEMES.filter((t) => t.id !== SYSTEM_THEME)

/** Contents, in page order: group, then its sections (id, title). */
export const CONTENTS: [string, [string, string][]][] = [
  ['Actions', [['button', 'Button'], ['toggle', 'Toggle'], ['toggle-group', 'Toggle group']]],
  ['Forms', [['input', 'Input and input group'], ['textarea', 'Textarea'], ['checkbox', 'Checkbox'], ['radio-group', 'Radio group'], ['switch', 'Switch'], ['slider', 'Slider'], ['field', 'Label and field']]],
  ['Overlays', [['dialog', 'Dialog'], ['alert-dialog', 'Alert dialog'], ['sheet', 'Sheet'], ['popover', 'Popover'], ['tooltip', 'Tooltip'], ['dropdown-menu', 'Dropdown menu'], ['command', 'Command']]],
  ['Navigation', [['tabs', 'Tabs'], ['breadcrumb', 'Breadcrumb']]],
  ['Display', [['card', 'Card'], ['badge', 'Badge'], ['alert', 'Alert'], ['empty', 'Empty'], ['kbd', 'Kbd'], ['separator', 'Separator'], ['skeleton', 'Skeleton and spinner'], ['table', 'Table'], ['collapsible', 'Collapsible']]],
  ['Composites', [['toast', 'Toast'], ['tip', 'Tip'], ['report-dialog', 'Report dialog'], ['account-menu', 'Account menu'], ['picker', 'Picker']]],
]
