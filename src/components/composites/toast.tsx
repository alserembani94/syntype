/**
 * The one toast (design system step 8): a <Toaster> per page and useToast().
 *
 * - Two live regions are always in the page, empty until needed, so screen
 *   readers announce every message: confirmations through role="status"
 *   (polite), errors through role="alert".
 * - Confirmations hide after HIDE_AFTER_MS, but the timer pauses while the
 *   pointer or focus is on the toast. Errors stay until dismissed (WCAG 2.2.1:
 *   nothing that needs action disappears on its own).
 * - A new message replaces the old one.
 * Our own rather than Sonner, which injects style tags our CSP blocks and
 * hard-codes its colours.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { HIDE_AFTER_MS, ToastContext, type Toast, type ToastApi } from './use-toast'

export function Toaster({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const next = useRef(0)
  const show = useCallback<ToastApi['show']>((message, options) => setToast({ id: ++next.current, message, tone: options?.tone ?? 'info' }), [])
  const dismiss = useCallback(() => setToast(null), [])
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])
  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Always present, so assistive tech is listening before the first message. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div role="status" aria-live="polite" className="contents">
          {toast?.tone === 'info' && <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />}
        </div>
        <div role="alert" className="contents">
          {toast?.tone === 'error' && <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [held, setHeld] = useState(0)
  const hovered = useRef(false)
  const focused = useRef(false)
  const hold = () => setHeld(Number(hovered.current) + Number(focused.current))
  // Confirmations hide on their own, unless the pointer or focus is on them.
  useEffect(() => {
    if (toast.tone === 'error' || held) return
    const timer = setTimeout(onDismiss, HIDE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [toast, held, onDismiss])
  return (
    <div
      data-slot="toast"
      data-tone={toast.tone}
      className={cn(
        'pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border bg-popover py-2 pr-2 pl-4 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2',
        toast.tone === 'error' && 'border-destructive',
      )}
      onPointerEnter={() => ((hovered.current = true), hold())}
      onPointerLeave={() => ((hovered.current = false), hold())}
      onFocus={() => ((focused.current = true), hold())}
      onBlur={() => ((focused.current = false), hold())}
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onPress={onDismiss}>
        <XIcon />
      </Button>
    </div>
  )
}
