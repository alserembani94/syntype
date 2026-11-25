/** Kept keystroke logs, stored gzipped (a log compresses to about a tenth). */
import type { LogEntry } from '../../src/lib/runcore'

export async function packLog(log: LogEntry[]): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(log)]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function unpackLog(bytes: ArrayBuffer): Promise<LogEntry[]> {
  const stream = new Response(new Uint8Array(bytes)).body!.pipeThrough(new DecompressionStream('gzip'))
  return JSON.parse(await new Response(stream).text()) as LogEntry[]
}
