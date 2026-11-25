/**
 * Main-thread side of the TypeScript worker. Started lazily, only when a
 * TypeScript snippet is loaded with IntelliSense on.
 */
import type { CompletionService, ServiceRequest, ServiceResponse, ServiceStatus } from '../service'

type Message =
  | { type: 'ready' }
  | { type: 'result'; id: number; response: ServiceResponse }
  | { type: 'error'; id: number; message: string }

export function createTypeScriptService(): CompletionService {
  let status: ServiceStatus = 'starting'
  const listeners = new Set<(s: ServiceStatus) => void>()
  const pending = new Map<number, { resolve: (r: ServiceResponse) => void; reject: (e: Error) => void }>()
  let nextId = 1

  const setStatus = (s: ServiceStatus) => {
    status = s
    listeners.forEach((l) => l(s))
  }

  let worker: Worker | null = null
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'typescript' })
    worker.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data
      if (m.type === 'ready') return setStatus('ready')
      const p = pending.get(m.id)
      if (!p) return
      pending.delete(m.id)
      if (m.type === 'result') p.resolve(m.response)
      else p.reject(new Error(m.message))
    }
    worker.onerror = () => {
      setStatus('failed')
      pending.forEach((p) => p.reject(new Error('TypeScript worker failed')))
      pending.clear()
    }
  } catch {
    // Workers unavailable: the game keeps the basic suggestions.
    queueMicrotask(() => setStatus('failed'))
  }

  return {
    status: () => status,
    onStatus(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    complete(request: ServiceRequest) {
      if (!worker || status !== 'ready') return Promise.reject(new Error('TypeScript is not ready'))
      const id = nextId++
      return new Promise<ServiceResponse>((resolve, reject) => {
        pending.set(id, { resolve, reject })
        worker!.postMessage({ id, request })
      })
    },
  }
}
