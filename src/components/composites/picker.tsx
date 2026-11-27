/**
 * The searchable, sectioned picker (languages, themes): shadcn's Command
 * (React Aria's Autocomplete over a Menu) in a Dialog. Typing filters across
 * sections; ↑ ↓ move between rows, skipping headings; Enter chooses; Esc or a
 * click outside closes. Design system step 8; wired into the app in step 11.
 *
 * Live preview: React Aria highlights rows with virtual focus (the caret stays
 * in the search box), so the highlighted row is read from each row's
 * isFocused render prop and reported through onActive. Hovering doesn't move
 * that highlight, so a hovered row (isHovered) is reported too: the preview
 * follows whichever the person touched last, keyboard or pointer.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useFilter } from 'react-aria-components'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface PickerProps<T> {
  /** The dialog's title, read by screen readers ("Choose a language"). */
  label: string
  placeholder: string
  items: T[]
  /** Section headings in display order; items are grouped under them. */
  sections: readonly string[]
  sectionOf: (item: T) => string
  idOf: (item: T) => string
  /** The row's text (its name; unique in the list). Without `matches`, a row shows when it contains the query. */
  textOf: (item: T) => string
  /** The app's own search rule (aliases, sections, fuzzy names), in place of a plain contains. */
  matches?: (item: T, query: string) => boolean
  currentId: string
  renderItem: (item: T) => ReactNode
  /** Called as the highlighted row changes, by keyboard or pointer (the theme picker's live preview). */
  onActive?: (item: T) => void
  onSelect: (id: string) => void
  onClose: () => void
  empty: ReactNode
  /** Controls under the list (the theme picker's caret switch). */
  footer?: ReactNode
}

/** Reports its row when React Aria marks it focused (virtual focus). */
function ActiveReporter({ focused, onFocused }: { focused: boolean; onFocused: () => void }) {
  const latest = useRef(onFocused)
  useEffect(() => {
    latest.current = onFocused
  })
  useEffect(() => {
    if (focused) latest.current()
  }, [focused])
  return null
}

/**
 * The highlighted row gets a bar at its start as well as the tint: in some
 * themes (One Dark Pro) the tint alone is hard to see.
 */
const HIGHLIGHT_BAR = 'before:absolute before:inset-y-1.5 before:left-0.5 before:w-0.5 before:rounded-full before:bg-primary before:opacity-0 data-focused:before:opacity-100'
/**
 * The current row is marked by its check (in the primary colour), not tinted:
 * the tint means highlighted, so the two can't be confused. The row's own
 * ml-auto part (a count, swatches) takes the free space; the check follows it.
 */
const ROW = `${HIGHLIGHT_BAR} data-selected:not-data-focused:bg-transparent [&>svg:last-child]:ml-0 [&>svg:last-child]:text-primary!`

export function Picker<T>({ label, placeholder, items, sections, sectionOf, idOf, textOf, matches, currentId, renderItem, onActive, onSelect, onClose, empty, footer }: PickerProps<T>) {
  const groups = sections.map((section) => ({ section, list: items.filter((i) => sectionOf(i) === section) })).filter((g) => g.list.length)
  const { contains } = useFilter({ sensitivity: 'base' })
  // Autocomplete filters by each row's text; `matches` gets the item that text belongs to.
  const byText = useMemo(() => new Map(items.map((i) => [textOf(i), i])), [items, textOf])
  const filter = (text: string, query: string) => {
    const item = byText.get(text)
    return matches && item ? matches(item, query) : contains(text, query)
  }

  /**
   * Keys the picker settles itself, before React Aria sees them:
   * - Esc closes it in one press, as it always has, whatever is typed. The
   *   search field would otherwise spend it clearing the text, and the list
   *   (whose current row is selected) clearing the selection, so the dialog
   *   never saw it.
   * - Enter goes to React Aria, which chooses the highlighted row. Right after
   *   the list is filtered it can miss it (a fast typist's "rust⏎" did
   *   nothing), so if nothing was chosen by the next frame, the picker chooses:
   *   the highlighted row, else the first match, else (nothing typed) the
   *   current one.
   */
  const chosen = useRef(false)
  const choose = (id: string) => {
    chosen.current = true
    onSelect(id)
  }
  const onKeyDownCapture = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Escape') {
      e.stopPropagation()
      e.preventDefault()
      onClose()
    } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      const input = e.target
      chosen.current = false
      requestAnimationFrame(() => {
        if (chosen.current || !input.isConnected) return
        const query = input.value
        const row = document.getElementById(input.getAttribute('aria-activedescendant') ?? '')
        const highlighted = row?.closest('[data-key]')?.getAttribute('data-key')
        const first = query ? groups.flatMap((g) => g.list).find((i) => filter(textOf(i), query)) : undefined
        if (highlighted) choose(highlighted)
        else if (!query) choose(currentId)
        else if (first) choose(idOf(first))
      })
    }
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(open) => !open && onClose()}
      showCloseButton={false}
      // Near the top rather than centred, so the search box stays put as results shrink, and stays
      // above a phone's on-screen keyboard (the list's height leaves room for it).
      className="top-[max(10vh,env(safe-area-inset-top))] translate-y-0 gap-0 overflow-hidden p-0 max-sm:top-[max(1rem,env(safe-area-inset-top))] sm:max-w-lg"
    >
      <DialogHeader className="sr-only">
        <DialogTitle>{label}</DialogTitle>
      </DialogHeader>
      <div className="contents" onKeyDownCapture={onKeyDownCapture}>
        <Command filter={filter}>
          <CommandInput placeholder={placeholder} />
          <CommandList
            className="max-h-[min(55dvh,26rem)]"
            aria-label={label}
            selectionMode="single"
            selectedKeys={[currentId]}
            onAction={(key) => choose(String(key))}
            renderEmptyState={() => <CommandEmpty>{empty}</CommandEmpty>}
          >
            {groups.map(({ section, list }) => (
              <CommandGroup key={section} id={section} heading={section} aria-label={section}>
                {list.map((item) => (
                  <CommandItem key={idOf(item)} id={idOf(item)} textValue={textOf(item)} className={ROW}>
                    {({ isFocused, isHovered }) => (
                      <>
                        <ActiveReporter focused={isFocused || isHovered} onFocused={() => onActive?.(item)} />
                        {renderItem(item)}
                      </>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </div>
      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </Dialog>
  )
}
