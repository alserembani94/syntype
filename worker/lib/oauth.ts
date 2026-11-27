/**
 * Signing in with GitHub or Google (OAuth 2.0 authorization code flow). Only
 * the basic profile is asked for: no email. The provider's access token is
 * used once, here, to read that profile, and never stored.
 */
import { fromBase64url } from './crypto'

export type Provider = 'github' | 'google'
export const PROVIDERS: Provider[] = ['github', 'google']

export interface OAuthConfig {
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
}

/** What sign-in learns: the provider's permanent id, and words for a suggested name. */
export interface Profile {
  providerId: string
  login?: string
  givenName?: string
}

export class SignInError extends Error {}

const callbackUrl = (origin: string, provider: Provider) => `${origin}/api/auth/${provider}/callback`

/** Where to send the player to sign in. `challenge` is PKCE's code challenge (S256), sent to both providers. */
export function authorizeUrl(provider: Provider, config: OAuthConfig, origin: string, state: string, challenge: string): string {
  if (provider === 'github') {
    // No scope: read-only access to public profile information.
    const q = new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID,
      redirect_uri: callbackUrl(origin, 'github'),
      state,
      allow_signup: 'true',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })
    return `https://github.com/login/oauth/authorize?${q}`
  }
  const q = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(origin, 'google'),
    response_type: 'code',
    scope: 'openid profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/** Exchanges the code the provider sent back for the player's profile. */
export async function exchange(
  provider: Provider,
  config: OAuthConfig,
  origin: string,
  code: string,
  verifier: string,
  fetchImpl: Fetch,
  now = Date.now(),
): Promise<Profile> {
  return provider === 'github' ? github(config, origin, code, verifier, fetchImpl) : google(config, origin, code, verifier, fetchImpl, now)
}

async function github(config: OAuthConfig, origin: string, code: string, verifier: string, fetchImpl: Fetch): Promise<Profile> {
  const tokenRes = await fetchImpl('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.GITHUB_CLIENT_ID,
      client_secret: config.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl(origin, 'github'),
      code_verifier: verifier,
    }),
  })
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!tokenRes.ok || !token.access_token) throw new SignInError(`GitHub refused the sign-in (${token.error ?? tokenRes.status}).`)
  const userRes = await fetchImpl('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Syntype' },
  })
  const user = (await userRes.json().catch(() => ({}))) as { id?: number; login?: string }
  if (!userRes.ok || typeof user.id !== 'number') throw new SignInError('Could not read your GitHub profile.')
  return { providerId: String(user.id), login: user.login }
}

async function google(config: OAuthConfig, origin: string, code: string, verifier: string, fetchImpl: Fetch, now: number): Promise<Profile> {
  const tokenRes = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.GOOGLE_CLIENT_ID,
      client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl(origin, 'google'),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  })
  const token = (await tokenRes.json().catch(() => ({}))) as { id_token?: string; error?: string }
  if (!tokenRes.ok || !token.id_token) throw new SignInError(`Google refused the sign-in (${token.error ?? tokenRes.status}).`)
  // The ID token came straight from Google's token endpoint over HTTPS, so its
  // claims can be read without checking the signature (OpenID Connect 3.1.3.7),
  // but they must still be for this app, from Google, and current.
  const claims = readJwt(token.id_token)
  if (!claims || !['https://accounts.google.com', 'accounts.google.com'].includes(String(claims.iss))) throw new SignInError('Google sent an unexpected sign-in.')
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(config.GOOGLE_CLIENT_ID)) throw new SignInError('That Google sign-in was for another app.')
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < now) throw new SignInError('That Google sign-in has expired. Try again.')
  if (typeof claims.sub !== 'string' || !claims.sub) throw new SignInError('Could not read your Google profile.')
  return { providerId: claims.sub, givenName: typeof claims.given_name === 'string' ? claims.given_name : undefined }
}

function readJwt(jwt: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64url(jwt.split('.')[1] ?? '')))
  } catch {
    return null
  }
}
