/**
 * Reading request bodies with a size cap. A body is refused as soon as it is
 * known to be too large: from Content-Length when the client sends it, and
 * otherwise while streaming, before the rest is read into memory.
 */

/** Most requests are small JSON: a name, a report, a fingerprint. */
export const SMALL_BODY = 8 * 1024

export type BodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 }

export async function readJson(request: Request, maxBytes = SMALL_BODY): Promise<BodyResult> {
  const declared = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 }
  if (!request.body) return { ok: false, status: 400 }
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return { ok: false, status: 413 }
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    bytes.set(c, at)
    at += c.byteLength
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }
  } catch {
    return { ok: false, status: 400 }
  }
}
