import { describe, expect, it } from 'vitest'
import { base64url, fromBase64url, sign, verify } from './crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

describe('base64url', () => {
  it('round-trips every length', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) % 256)
      expect(fromBase64url(base64url(bytes))).toEqual(bytes)
    }
  })

  it('accepts only the one spelling base64url() makes', () => {
    // 1 byte: two characters, the second with 4 unused bits. "AA" is canonical, "AB" … "AP" decode to the same byte.
    expect(fromBase64url('AA')).toEqual(new Uint8Array([0]))
    for (const text of ['AB', 'AP', 'AA=', 'A A', 'AA\n', 'A+', 'A/']) expect(() => fromBase64url(text)).toThrow()
  })
})

describe('signed tokens', () => {
  it('reject every other last character of the signature, including ones that differ only in unused bits', async () => {
    // A 32-byte HMAC is 43 characters; the last holds 4 bits and 2 unused ones, so atob alone
    // read 4 spellings of each signature as the same. This used to fail 1 time in 16 (sessions test).
    const token = await sign('secret', { p: 1, exp: Date.now() + 60_000 })
    expect(await verify('secret', token)).not.toBeNull()
    const head = token.slice(0, -1)
    for (const c of ALPHABET) if (c !== token.at(-1)) expect(await verify('secret', head + c), c).toBeNull()
  })
})
