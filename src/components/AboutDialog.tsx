import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** The page's own about section (written into the HTML by scripts/build-pages.mjs). */
  section: HTMLElement
  /** A language link inside was chosen: switch to it here rather than reloading the page. */
  onLanguage: (path: string) => boolean
  onClose: () => void
}

const FOCUSABLE = 'a[href], button:not([disabled])'

/**
 * Shows the about section as a modal. The section stays the same element in
 * the page, so search engines read the same text; this only changes how it's
 * shown, and adds a close button and a backdrop.
 */
export function AboutDialog({ section, onLanguage, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const latest = useRef({ onLanguage, onClose })
  useEffect(() => {
    latest.current = { onLanguage, onClose }
  })

  useEffect(() => {
    section.classList.add('open')
    section.setAttribute('role', 'dialog')
    section.setAttribute('aria-modal', 'true')
    closeRef.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        latest.current.onClose()
      } else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const items = [...section.querySelectorAll<HTMLElement>(FOCUSABLE)]
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a') : null
      if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && latest.current.onLanguage(link.getAttribute('href') ?? '')) e.preventDefault()
    }
    section.addEventListener('keydown', onKey)
    section.addEventListener('click', onClick)
    return () => {
      section.removeEventListener('keydown', onKey)
      section.removeEventListener('click', onClick)
      section.classList.remove('open')
      section.removeAttribute('role')
      section.removeAttribute('aria-modal')
    }
  }, [section])

  return (
    <>
      {createPortal(<div className="about-backdrop" onMouseDown={onClose} />, document.body)}
      {createPortal(
        <button ref={closeRef} type="button" className="about-close" onClick={onClose} aria-label="Close">
          <kbd>esc</kbd>
        </button>,
        section,
      )}
    </>
  )
}
