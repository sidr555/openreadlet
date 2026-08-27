import { describe, expect, it, vi } from 'vitest'
import type { LibError } from '../../src/errors.js'
import { httpGet } from '../../src/sources/http.js'

const TARGET = 'https://s3.example.com/birds/feed.json'

const respond = (body: string, init: ResponseInit & { url?: string } = {}): Response => {
  const response = new Response(body, init)
  Object.defineProperty(response, 'url', { value: init.url ?? TARGET })

  return response
}

const sameOrigin = (target: URL, landed: URL): boolean => target.origin === landed.origin

const codeOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run()
  } catch (error) {
    return (error as LibError).code
  }

  return 'no-error'
}

describe('httpGet', () => {
  it('refuses a landing the policy rejects', async () => {
    const doFetch = vi.fn(async () => respond('{}', { url: 'https://elsewhere.example.net/x' }))

    expect(await codeOf(() => httpGet(TARGET, 1000, { fetch: doFetch }, sameOrigin))).toBe(
      'foreign-origin',
    )
  })

  it('accepts a landing the policy allows', async () => {
    const landed = 'https://s151nrg.storage.yandex.net/rdisk/abc'
    const doFetch = vi.fn(async () => respond('hello', { url: landed }))
    const allow = (_t: URL, l: URL): boolean => l.host.endsWith('.storage.yandex.net')

    const payload = await httpGet(TARGET, 1000, { fetch: doFetch }, allow)

    expect(new TextDecoder().decode(payload.bytes)).toBe('hello')
  })

  it('refuses a landing address that is not a URL', async () => {
    const doFetch = vi.fn(async () => respond('{}', { url: 'not a url' }))

    expect(await codeOf(() => httpGet(TARGET, 1000, { fetch: doFetch }, sameOrigin))).toBe(
      'foreign-origin',
    )
  })
})
