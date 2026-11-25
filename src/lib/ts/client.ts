/**
 * Main-thread side of the TypeScript worker, shared by JavaScript and
 * TypeScript. Started the first time a snippet needs it.
 */
import type { CompletionService, ServiceRequest, ServiceResponse, ServiceStatus } from '../service'

type Message =
  | { type: 'ready' }
  | { type: 'result'; id: number; response: ServiceResponse }
  | { type: 'error'; id: number; message: string }

/**
 * A page can carry the worker's code itself in
 * <script type="text/plain" id="ts-worker-source">. The single-page artifact
 * build does this, because there the page may have no address of its own to
 * resolve a separate worker file against.
 */
export const INLINE_WORKER_ID = 'ts-worker-source'

/** Starting the service (loading 4 MB of compiler) takes a second or two; give up well after that. */
const START_TIMEOUT_MS = 30_000

function startWorker(): Worker {
  const inline = typeof document !== 'undefined' ? document.getElementById(INLINE_WORKER_ID)?.textContent : null
  if (inline) {
    const url = URL.createObjectURL(new Blob([inline], { type: 'text/javascript' }))
    // Classic, not module: the bundle has no imports, and classic blob workers
    // also start in sandboxed pages, where module workers are refused.
    return new Worker(url, { name: 'typescript' })
  }
  // Vite bundles the worker from this exact pattern into its own file.
  return new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'typescript' })
}

let shared: CompletionService | null = null

/** One worker for the whole page, started the first time it's needed. */
export const getTypeScriptService = () => (shared ??= createTypeScriptService())

export function createTypeScriptService(): CompletionService {
  let status: ServiceStatus = 'starting'
  let failure: string | undefined
  const listeners = new Set<(s: ServiceStatus) => void>()
  const pending = new Map<number, { resolve: (r: ServiceResponse) => void; reject: (e: Error) => void }>()
  let nextId = 1

  const setStatus = (s: ServiceStatus) => {
    status = s
    listeners.forEach((l) => l(s))
  }
  const fail = (reason: string) => {
    if (status === 'failed') return
    failure = reason
    console.warn(`TypeScript autocomplete unavailable: ${reason}`)
    pending.forEach((p) => p.reject(new Error(reason)))
    pending.clear()
    setStatus('failed')
  }

  let worker: Worker | null = null
  try {
    worker = startWorker()
    const timer = setTimeout(() => status === 'starting' && fail('it took too long to start'), START_TIMEOUT_MS)
    worker.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data
      if (m.type === 'ready') {
        clearTimeout(timer)
        return setStatus('ready')
      }
      const p = pending.get(m.id)
      if (!p) return
      pending.delete(m.id)
      if (m.type === 'result') p.resolve(m.response)
      else p.reject(new Error(m.message))
    }
    worker.onerror = (e) => {
      clearTimeout(timer)
      fail(e.message || 'the worker could not be loaded')
    }
  } catch (err) {
    // Workers blocked or unsupported: the game keeps the basic suggestions.
    const reason = err instanceof Error ? err.message : String(err)
    queueMicrotask(() => fail(reason))
  }

  return {
    status: () => status,
    failure: () => failure,
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
