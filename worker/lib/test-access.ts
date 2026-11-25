/**
 * Tests only: plays Cloudflare Access, with its own RSA key pair, its key
 * list (as <team>/cdn-cgi/access/certs serves it) and the tokens it signs.
 */
import { base64url } from './crypto'

export const TEAM = 'https://syntype-test.cloudflareaccess.com'
export const AUD = 'test-admin-aud'

export async function fakeAccess(kid = 'key-1') {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'RS256', use: 'sig' }
  const encode = (o: unknown) => base64url(new TextEncoder().encode(JSON.stringify(o)))
  let certsFetched = 0

  /** A token as Access would sign it; override any claim (or the header) to forge a bad one. */
  const token = async (claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000)
    const body = `${encode({ alg: 'RS256', kid, typ: 'JWT', ...header })}.${encode({
      aud: [AUD],
      email: 'owner@example.com',
      exp: now + 600,
      iat: now,
      nbf: now,
      iss: TEAM,
      type: 'app',
      sub: 'owner-sub',
      ...claims,
    })}`
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(body)))
    return `${body}.${base64url(sig)}`
  }
  /** Answers the key list request; anything else is a 500. */
  const fetchImpl = async (input: string) => {
    if (input === `${TEAM}/cdn-cgi/access/certs`) {
      certsFetched++
      return Response.json({ keys: [jwk], public_cert: { kid, cert: '' } })
    }
    return new Response('unexpected', { status: 500 })
  }
  return { token, fetchImpl, certsFetched: () => certsFetched }
}
