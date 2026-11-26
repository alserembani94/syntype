/**
 * Mounts a component in the real browser page for *.browser.test.tsx
 * (Vitest browser mode), with the app's own stylesheet, so layout, focus and
 * colours are real. Each test gets a fresh root; the previous one is unmounted.
 */
import type { ReactNode } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { page } from 'vitest/browser'
import '../styles/admin.css'

// Tell React these tests drive it with act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Themes cross-fade their colours over 0.7 s; tests switch themes at once, as reduced motion does.
const still = document.createElement('style')
still.textContent = ':root { transition: none !important; }'
document.head.append(still)

let root: Root | null = null
let host: HTMLElement | null = null

export async function mount(ui: ReactNode, theme = 'light') {
  if (root) act(() => root!.unmount())
  host?.remove()
  document.documentElement.setAttribute('data-syntype-theme', theme)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(async () => root!.render(ui))
  return page
}
