/// <reference lib="webworker" />
/**
 * Runs TypeScript's language service off the main thread, so a slow
 * completion never delays a keystroke.
 */
import { createCompleter } from './completer'
import { LIB_FILES } from './libs'
import { EXPRESS_D_TS, HOST_D_TS, REACT_D_TS } from './stubs'
import type { ServiceRequest } from '../service'

const completer = createCompleter({
  ...LIB_FILES,
  'host.d.ts': HOST_D_TS,
  'react.d.ts': REACT_D_TS,
  'express.d.ts': EXPRESS_D_TS,
})

// Warm up: the first request builds the program and is by far the slowest.
completer.complete({ text: 'const warm = 1;\nwarm.', offset: 21, trigger: '.' })
self.postMessage({ type: 'ready' })

self.onmessage = (e: MessageEvent<{ id: number; request: ServiceRequest }>) => {
  const { id, request } = e.data
  try {
    self.postMessage({ type: 'result', id, response: completer.complete(request) })
  } catch (err) {
    self.postMessage({ type: 'error', id, message: String(err) })
  }
}
