/**
 * A language's completion service: something that understands the code (like
 * TypeScript's language service) and answers "what can go here?". It runs
 * asynchronously, usually in a worker. Languages without one use keywords,
 * vocabulary packs and words already typed instead (see suggest.ts).
 */
import type { SuggestionKind } from '../languages/types'

export type ServiceStatus = 'starting' | 'ready' | 'failed'

export interface ServiceRequest {
  /** The editor buffer: everything on screen, including auto-inserted text after the caret. */
  text: string
  /** Caret offset in `text`. */
  offset: number
  /** The character that opened the list, if it was a trigger character such as ".". */
  trigger?: string
  /** For services that handle several languages, which one this buffer is in. */
  mode?: string
}

export interface ServiceEntry {
  name: string
  kind: SuggestionKind
  /** The service's own priority; lower sorts first on ties, as in VS Code. */
  sortText: string
  optional?: boolean
  /** VS Code pre-selects recommended items. */
  preselect?: boolean
  /** Characters that accept this item and are then typed. */
  commit?: string[]
}

export interface ServiceResponse {
  entries: ServiceEntry[]
}

export interface CompletionService {
  status(): ServiceStatus
  onStatus(listener: (status: ServiceStatus) => void): () => void
  complete(request: ServiceRequest): Promise<ServiceResponse>
}
