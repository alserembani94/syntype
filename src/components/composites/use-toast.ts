/** The toast's API and context; the component is <Toaster> in ./toast.tsx. */
import { createContext, useContext, type ReactNode } from 'react'

export const HIDE_AFTER_MS = 6000

export type ToastTone = 'info' | 'error'
export interface Toast {
  id: number
  message: ReactNode
  tone: ToastTone
}
export interface ToastApi {
  /** Shows a message; `tone: 'error'` for something that went wrong. */
  show: (message: ReactNode, options?: { tone?: ToastTone }) => void
  dismiss: () => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const api = useContext(ToastContext)
  if (!api) throw new Error('useToast needs a <Toaster> above it')
  return api
}

