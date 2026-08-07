import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { LibError } from '../src/errors.js'
import { fetchLibs, openLib } from '../src/lib.js'

const BASE = 'https://s3.example.com/birds'

const example = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../examples/${name}`, import.meta.url)), 'utf8')

const serve = (byUrl: Record<string, string>) =>
  vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    const body = byUrl[url]

    if (body === undefined) {
      const missing = new Response('', { status: 404 })
      Object.defineProperty(missing, 'url', { value: url })

      return missing
    }

    const response = new Response(body)
    Object.defineProperty(response, 'url', { value: url })

    return response
  })

describe('openLib', () => {
  it('reads the showcase from the lib base address', async () => {
    const doFetch = serve({ [`${BASE}/about.json`]: example('about.json') })
    const lib = openLib(BASE, { fetch: doFetch })

    await expect(lib.about()).resolves.toMatchObject({ title: 'Backyard Birds' })
  })

  it('reads a bundle by identifier', async () => {
    const doFetch = serve({ [`${BASE}/bundles/spring-2026.json`]: example('bundle.json') })
    const lib = openLib(BASE, { fetch: doFetch })

    await expect(lib.bundle('spring-2026')).resolves.toMatchObject({
      ver: { major: 1, minor: 0 },
    })
  })

  it('returns the readlet text as a raw string', async () => {
    const markdown = '# Who sings before sunrise\n\nThe thrush does.\n'
    const doFetch = serve({ [`${BASE}/text/dawn-song.md`]: markdown })
    const lib = openLib(BASE, { fetch: doFetch })

    await expect(lib.text('dawn-song')).resolves.toBe(markdown)
  })

  it('builds the cover address without touching the network', () => {
    const doFetch = serve({})
    const lib = openLib(BASE, { fetch: doFetch })

    expect(lib.picUrl('dawn-song')).toBe(`${BASE}/pic/dawn-song.webp`)
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('refuses an identifier that would walk out of the base', async () => {
    const lib = openLib(BASE, { fetch: serve({}) })

    try {
      await lib.text('../../etc/passwd')
      expect.unreachable('text must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('bad-id')
    }
  })

  it('refuses an http base address before any request', () => {
    expect(() => openLib('http://s3.example.com/birds')).toThrowError()
  })

  it('does not carry a refused password in the error it throws', () => {
    try {
      openLib('https://user:pass@s3.example.com/birds')
      expect.unreachable('openLib must throw')
    } catch (error) {
      expect((error as LibError).url).not.toContain('pass')
    }
  })

  it('caps the text with its own limit, not the manifest one', async () => {
    const doFetch = serve({ [`${BASE}/text/dawn-song.md`]: 'x'.repeat(2048) })
    const lib = openLib(BASE, { fetch: doFetch, maxTextBytes: 1024 })

    await expect(lib.text('dawn-song')).rejects.toMatchObject({ code: 'too-large' })
  })

  it('reads the feed', async () => {
    const doFetch = serve({ [`${BASE}/feed.json`]: example('feed.json') })
    const lib = openLib(BASE, { fetch: doFetch })

    await expect(lib.feed()).resolves.toMatchObject({ ver: { major: 1, minor: 0 } })
  })

  it('reads a quiz', async () => {
    const doFetch = serve({ [`${BASE}/test/dawn-song.json`]: example('test.json') })
    const lib = openLib(BASE, { fetch: doFetch })

    await expect(lib.test('dawn-song')).resolves.toMatchObject({ timer: '3m' })
  })

  it('reads the cover as a blob', async () => {
    const doFetch = vi.fn(async () => {
      const response = new Response('binary-bytes', {
        headers: { 'content-type': 'image/webp' },
      })
      Object.defineProperty(response, 'url', { value: `${BASE}/pic/dawn-song.webp` })

      return response
    })
    const lib = openLib(BASE, { fetch: doFetch })

    const blob = await lib.pic('dawn-song')

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/webp')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('honours an already-aborted per-call signal instead of the base options', async () => {
    const doFetch = serve({ [`${BASE}/about.json`]: example('about.json') })
    const lib = openLib(BASE, { fetch: doFetch })

    await expect(lib.about({ signal: AbortSignal.abort() })).rejects.toBeDefined()
    expect(doFetch).not.toHaveBeenCalled()
  })
})

describe('fetchLibs', () => {
  const CATALOGUE = 'https://libs.example.com/catalogue.json'

  it('reads a catalogue from an arbitrary address', async () => {
    const doFetch = serve({ [CATALOGUE]: example('libs.json') })

    await expect(fetchLibs(CATALOGUE, { fetch: doFetch })).resolves.toMatchObject({
      ver: { major: 1, minor: 0 },
    })
  })

  it('refuses an http catalogue address before any request', async () => {
    const doFetch = serve({})

    await expect(
      fetchLibs('http://libs.example.com/catalogue.json', { fetch: doFetch }),
    ).rejects.toMatchObject({ code: 'insecure-origin' })
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('refuses a catalogue address carrying credentials', async () => {
    const doFetch = serve({})

    await expect(
      fetchLibs('https://user:pass@libs.example.com/catalogue.json', { fetch: doFetch }),
    ).rejects.toMatchObject({ code: 'insecure-origin' })
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('does not carry the refused password in the error it raises', async () => {
    const doFetch = serve({})

    try {
      await fetchLibs('https://user:pass@libs.example.com/catalogue.json', { fetch: doFetch })
      expect.unreachable('fetchLibs must throw')
    } catch (error) {
      expect((error as LibError).url).not.toContain('pass')
    }
  })

  it('does not leak a password through a non-special scheme (missing "https://")', async () => {
    const doFetch = serve({})

    try {
      await fetchLibs('admin:hunter2@libs.example.com/birds', { fetch: doFetch })
      expect.unreachable('fetchLibs must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
      expect((error as LibError).url).toBeUndefined()
      expect((error as LibError).message).not.toContain('hunter2')
    }
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('accepts a catalogue address carrying a query string', async () => {
    const withQuery = `${CATALOGUE}?v=2`
    const doFetch = serve({ [withQuery]: example('libs.json') })

    await expect(fetchLibs(withQuery, { fetch: doFetch })).resolves.toMatchObject({
      ver: { major: 1, minor: 0 },
    })
  })
})
