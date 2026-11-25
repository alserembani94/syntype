import { beforeEach, describe, expect, it } from 'vitest'
import { accessEmail, clearAccessKeys, ACCESS_HEADER, type AccessConfig } from './access'
import { AUD, fakeAccess, TEAM } from './test-access'

const config: AccessConfig = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }
const req = (token?: string, url = 'https://syntype.vercel.my/api/admin/me') => new Request(url, { headers: token ? { [ACCESS_HEADER]: token } : {} })

beforeEach(() => clearAccessKeys())

describe('the Cloudflare Access check', () => {
  it('accepts a token Access signed for this application, and gives the email', async () => {
    const access = await fakeAccess()
    expect(await accessEmail(req(await access.token()), config, access.fetchImpl, Date.now())).toBe('owner@example.com')
    // The keys are fetched once and kept.
    await accessEmail(req(await access.token()), config, access.fetchImpl, Date.now())
    expect(access.certsFetched()).toBe(1)
  })

  it('refuses no token, a forged one, or one for another app or team', async () => {
    const access = await fakeAccess()
    const other = await fakeAccess()
    const check = async (token?: string) => accessEmail(req(token), config, access.fetchImpl, Date.now())
    expect(await check()).toBeNull()
    expect(await check('not.a.token')).toBeNull()
    // Signed by someone else's key with the same key ID.
    expect(await check(await other.token())).toBeNull()
    // A changed claim breaks the signature.
    const good = (await access.token()).split('.')
    const tampered = await access.token({ email: 'intruder@example.com' })
    expect(await check([good[0], tampered.split('.')[1], good[2]].join('.'))).toBeNull()
    expect(await check(await access.token({ aud: ['another-app'] }))).toBeNull()
    expect(await check(await access.token({ iss: 'https://evil.cloudflareaccess.com' }))).toBeNull()
    expect(await check(await access.token({}, { alg: 'none' }))).toBeNull()
    expect(await check(await access.token({}, { kid: 'unknown' }))).toBeNull()
    // A service token: genuine, but not a person.
    expect(await check(await access.token({ email: undefined, common_name: 'svc' }))).toBeNull()
  })

  it('refuses an expired token, or one not valid yet', async () => {
    const access = await fakeAccess()
    const now = Date.now()
    const s = Math.floor(now / 1000)
    expect(await accessEmail(req(await access.token({ exp: s - 1 })), config, access.fetchImpl, now)).toBeNull()
    expect(await accessEmail(req(await access.token({ nbf: s + 3600 })), config, access.fetchImpl, now)).toBeNull()
  })

  it('refetches the keys when Access rotates them, but not more than once a minute', async () => {
    const first = await fakeAccess('old')
    const now = Date.now()
    expect(await accessEmail(req(await first.token()), config, first.fetchImpl, now)).toBe('owner@example.com')
    const rotated = await fakeAccess('new')
    const token = await rotated.token()
    expect(await accessEmail(req(token), config, rotated.fetchImpl, now + 1000)).toBeNull()
    expect(rotated.certsFetched()).toBe(0)
    expect(await accessEmail(req(token), config, rotated.fetchImpl, now + 61_000)).toBe('owner@example.com')
  })

  it('without Access configured, nobody is an admin', async () => {
    const access = await fakeAccess()
    expect(await accessEmail(req(await access.token()), { ACCESS_TEAM_DOMAIN: '', ACCESS_AUD: '' }, access.fetchImpl, Date.now())).toBeNull()
  })

  it('the development stand-in works on localhost only', async () => {
    const dev = { ...config, ADMIN_DEV_EMAIL: 'dev@localhost' }
    const access = await fakeAccess()
    expect(await accessEmail(req(undefined, 'http://localhost:8787/api/admin/me'), dev, access.fetchImpl, Date.now())).toBe('dev@localhost')
    expect(await accessEmail(req(undefined, 'http://127.0.0.1:8787/api/admin/me'), dev, access.fetchImpl, Date.now())).toBe('dev@localhost')
    expect(await accessEmail(req(), dev, access.fetchImpl, Date.now())).toBeNull()
  })
})
