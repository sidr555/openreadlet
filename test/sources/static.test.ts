import { describe, expect, it, vi } from 'vitest'
import { staticSource } from '../../src/sources/static.js'

const BASE = 'https://s3.example.com/birds'

const respond = (body: string, url: string): Response => {
  const response = new Response(body)
  Object.defineProperty(response, 'url', { value: url })

  return response
}

describe('staticSource', () => {
  it('joins the path to the base and reads it', async () => {
    const doFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : new URL(input.url).href
      return respond('hello', url)
    })
    const source = staticSource(BASE)

    const payload = await source.get('text/dawn-song.md', 1000, { fetch: doFetch })

    const callArg = doFetch.mock.calls[0]?.[0]
    const urlString =
      typeof callArg === 'string'
        ? callArg
        : callArg instanceof URL
          ? callArg.href
          : new URL((callArg as Request).url).href
    expect(urlString).toBe(`${BASE}/text/dawn-song.md`)
    expect(new TextDecoder().decode(payload.bytes)).toBe('hello')
  })

  it('offers a direct address for a cover', () => {
    expect(staticSource(BASE).directUrl('pic/dawn-song.webp')).toBe(`${BASE}/pic/dawn-song.webp`)
  })

  it('trims a trailing slash so a direct call does not double it', () => {
    const source = staticSource(`${BASE}/`)

    expect(source.base).toBe(BASE)
    expect(source.directUrl('pic/dawn-song.webp')).toBe(`${BASE}/pic/dawn-song.webp`)
  })
})
