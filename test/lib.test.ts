import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { LibError } from '../src/errors.js'
import { openLib } from '../src/lib.js'

const BASE = 'https://s3.example.com/birds'

const example = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../examples/${name}`, import.meta.url)), 'utf8')

const serve = (byUrl: Record<string, string>) =>
  vi.fn(async (input: RequestInfo | URL) => {
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

  it('caps the text with its own limit, not the manifest one', async () => {
    const doFetch = serve({ [`${BASE}/text/dawn-song.md`]: 'x'.repeat(2048) })
    const lib = openLib(BASE, { fetch: doFetch, maxTextBytes: 1024 })

    await expect(lib.text('dawn-song')).rejects.toMatchObject({ code: 'too-large' })
  })
})
