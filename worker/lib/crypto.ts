/** Signing and random values, with the Web Crypto API (Workers and Node both have it). */

const encoder = new TextEncoder()

export function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * The bytes of canonical base64url text; throws on anything else. atob alone is
 * lenient: it skips whitespace and ignores the unused low bits of the last
 * character, so several texts decode to the same bytes (a 32-byte HMAC ending in
 * `A` also verifies ending in `B`, `C` or `D`). A signed token must have exactly
 * one spelling, so the text must be what base64url() makes of its own bytes.
 */
export function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const b = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4))
  const bytes = Uint8Array.from(b, (c) => c.charCodeAt(0))
  if (base64url(bytes) !== text) throw new Error('Not canonical base64url.')
  return bytes
}

/** Unguessable random text: `bytes` of randomness, base64url-encoded. */
export const randomToken = (bytes = 32) => base64url(crypto.getRandomValues(new Uint8Array(bytes)))

const keys = new Map<string, Promise<CryptoKey>>()
const hmacKey = (secret: string) => {
  let key = keys.get(secret)
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
    keys.set(secret, key)
  }
  return key
}

/**
 * A tamper-proof token: the JSON payload and its HMAC-SHA256 signature. Anyone
 * can read the payload, so it never holds anything secret; nobody without the
 * secret can change it. `exp` (ms since 1970) makes it expire.
 */
export async function sign(secret: string, payload: Record<string, unknown> & { exp: number }): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(payload)))
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(body)))
  return `${body}.${base64url(sig)}`
}

/** The payload of a token made by sign(), or null if it's forged, malformed or expired. */
export async function verify<T extends { exp: number }>(secret: string, token: string | undefined, now = Date.now()): Promise<T | null> {
  if (!token) return null
  const [body, sig, extra] = token.split('.')
  if (!body || !sig || extra !== undefined) return null
  try {
    // crypto.subtle.verify compares in constant time.
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64url(sig), encoder.encode(body))
    if (!ok) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as T
    return typeof payload.exp === 'number' && payload.exp > now ? payload : null
  } catch {
    return null
  }
}

/** SHA-256 of text, base64url: PKCE's code challenge. */
export async function sha256(text: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))))
}
