import { describe, expect, it } from 'vitest'
import { sign, verify } from './crypto'

describe('verify', () => {
  it('accepts a token only in the exact form sign() wrote', async () => {
    const payload = { p: 1, exp: Date.now() + 60_000 }
    const token = await sign('secret', payload)
    expect(await verify('secret', token)).toEqual(payload)
    // A 32-byte signature is 43 characters; the last carries 4 bits and 2 unused ones. Setting the unused
    // bits decodes to the same bytes, but it isn't the token that was issued.
    const last = token.at(-1)!
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    const respelled = token.slice(0, -1) + alphabet[alphabet.indexOf(last) | 1]
    expect(respelled).not.toBe(token)
    expect(await verify('secret', respelled)).toBeNull()
  })

  it('rejects a changed signature or payload', async () => {
    const token = await sign('secret', { p: 1, exp: Date.now() + 60_000 })
    const [body, sig] = token.split('.')
    const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1)
    expect(await verify('secret', `${body}.${flip(sig, 20)}`)).toBeNull()
    expect(await verify('secret', `${flip(body, 5)}.${sig}`)).toBeNull()
  })
})
