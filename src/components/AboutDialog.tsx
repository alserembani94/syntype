import { useEffect, useLayoutEffect, useRef } from 'react'
import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive, Modal } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import { DialogOverlay } from '@/components/ui/dialog'

interface Props {
  /** The page's own about section (written into the HTML by scripts/build-pages.mjs). */
  section: HTMLElement
  /** A language link inside was chosen: switch to it here rather than reloading the page. */
  onLanguage: (path: string) => boolean
  onClose: () => void
}

/**
 * Shows the page's about section as a modal (design system step 11). The
 * section stays the same element, so search engines and the dialog show the
 * same text: while open it's moved into a React Aria modal (shadcn's overlay,
 * which contains focus, locks scrolling, hides the page behind from assistive
 * tech, and closes on Esc or a click outside), and put back where it was on
 * close. Titled by the section's own heading.
 */
export function AboutDialog({ section, onLanguage, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const latest = useRef({ onLanguage, onClose })
  useEffect(() => {
    latest.current = { onLanguage, onClose }
  })
  const heading = section.querySelector('h2')
  if (heading && !heading.id) heading.id = 'about-title'

  // Before paint, so the dialog never shows empty.
  useLayoutEffect(() => {
    const place = document.createComment('about')
    section.replaceWith(place)
    host.current?.append(section)
    section.classList.add('open')
    closeRef.current?.focus()
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a') : null
      if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && latest.current.onLanguage(link.getAttribute('href') ?? '')) e.preventDefault()
    }
    section.addEventListener('click', onClick)
    return () => {
      section.removeEventListener('click', onClick)
      section.classList.remove('open')
      place.replaceWith(section)
    }
  }, [section])

  return (
    <DialogOverlay isOpen isDismissable onOpenChange={(open) => !open && latest.current.onClose()}>
      <Modal className="fixed top-[max(6vh,env(safe-area-inset-top))] left-1/2 z-50 max-h-[min(86dvh,760px)] w-[min(820px,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 max-sm:top-[max(1rem,env(safe-area-inset-top))] max-sm:max-h-[calc(100dvh-2rem)]">
        <DialogPrimitive aria-labelledby={heading?.id} className="relative px-8 pt-7 pb-6 outline-none max-sm:px-4.5 max-sm:pt-5.5 max-sm:pb-4.5">
          <div ref={host} />
          <Button ref={closeRef} variant="ghost" size="icon-sm" slot="close" aria-label="Close" className="absolute top-3 right-3">
            <XIcon />
          </Button>
        </DialogPrimitive>
      </Modal>
    </DialogOverlay>
  )
}
