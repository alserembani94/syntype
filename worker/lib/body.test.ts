import { describe, expect, it } from 'vitest'
import { readJson } from './body'
import { readCookies } from './cookies'
import { fromCache, sharedCacheKey } from './cachekey'

const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request('https://syntype.vercel.my/api/x', { method: 'POST', body, headers })
/** A body with no Content-Length: streamed in chunks, as a client may send it. */
const streamed = (chunks: number, size: number) =>
  new Request('https://syntype.vercel.my/api/x', {
    method: 'POST',
    body: new ReadableStream({
      start(c) {
        for (let i = 0; i < chunks; i++) c.enqueue(new Uint8Array(size).fill(32))
        c.close()
      },
    }),
    // @ts-expect-error Node needs this for a streamed request body.
    duplex: 'half',
  })

describe('reading request bodies', () => {
  it('reads JSON within the cap', async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ ok: true, value: { a: 1 } })
  })
  it('refuses a body declared too large, before reading it', async () => {
    expect(await readJson(post('{}', { 'Content-Length': '999999' }), 1024)).toEqual({ ok: false, status: 413 })
  })
  it('stops reading a streamed body as soon as it passes the cap, counting bytes', async () => {
    expect(await readJson(streamed(10, 1024), 4096)).toEqual({ ok: false, status: 413 })
    // Three-byte characters: 2,000 of them is 6,000 bytes, though only 2,000 UTF-16 units.
    expect(await readJson(post(JSON.stringify('€'.repeat(2000))), 4096)).toEqual({ ok: false, status: 413 })
  })
  it('reports a body that isn’t JSON, or is missing', async () => {
    expect(await readJson(post('not json'))).toEqual({ ok: false, status: 400 })
    expect(await readJson(new Request('https://syntype.vercel.my/api/x', { method: 'POST' }))).toEqual({ ok: false, status: 400 })
  })
})

describe('cookies', () => {
  it('skips a malformed cookie instead of failing the request', () => {
    expect(readCookies('broken=%E0%A4%A; syntype_session=abc.def')).toEqual({ syntype_session: 'abc.def' })
  })
})

describe('the edge cache key', () => {
  const key = (path: string, method = 'GET') => sharedCacheKey(new Request(`https://syntype.vercel.my${path}`, { method }))
  const fp = 'a'.repeat(64)
  it('uses only the parameters a route accepts, so extra ones can’t miss the cache', () => {
    expect(key('/api/boards?lang=python&x=1')).toBe('https://syntype.vercel.my/api/boards?lang=python')
    expect(key(`/api/boards/${fp}?aids=110&cachebust=9`)).toBe(`https://syntype.vercel.my/api/boards/${fp}?aids=110`)
    expect(key(`/api/boards/${fp}?aids=nonsense`)).toBe(`https://syntype.vercel.my/api/boards/${fp}?aids=any`)
    expect(key('/api/replays/run-1?x=2')).toBe('https://syntype.vercel.my/api/replays/run-1')
  })
  it('never caches personal or changing answers', () => {
    expect(key(`/api/boards/${fp}/me`)).toBeNull()
    expect(key('/api/me')).toBeNull()
    expect(key('/api/admin/reports')).toBeNull()
    expect(key('/api/boards?lang=python', 'POST')).toBeNull()
    expect(key('/api/boards?lang=../x')).toBeNull()
  })
})

describe('answers served from the edge cache', () => {
  it('keep the 60-second browser cache, whatever the zone rewrote it to', async () => {
    const stored = new Response('{"rows":[]}', { status: 200, headers: { 'Cache-Control': 'public, max-age=14400', 'Content-Type': 'application/json' } })
    const sent = fromCache(stored)
    expect(sent.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(sent.headers.get('Content-Type')).toBe('application/json')
    expect(await sent.text()).toBe('{"rows":[]}')
  })
})
