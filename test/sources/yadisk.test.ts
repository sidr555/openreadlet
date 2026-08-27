import { describe, expect, it, vi } from 'vitest'
import type { LibError } from '../../src/errors.js'
import { yadiskSource } from '../../src/sources/yadisk.js'

const INNER = 'https://disk.yandex.ru/d/Ctzap_DTvZ3xVQ'
const HREF = 'https://downloader.disk.yandex.ru/disk/abc?hash=x&s=sig'
const LANDED = 'https://s151nrg.storage.yandex.net/rdisk/abc'

const respond = (body: string, url: string, status = 200): Response => {
  const response = new Response(body, { status })
  Object.defineProperty(response, 'url', { value: url })

  return response
}

const urlOf = (input: RequestInfo | URL | undefined): string =>
  input instanceof Request ? input.url : String(input)

const chain = (body: string) =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = urlOf(input)

    if (url.startsWith('https://cloud-api.yandex.net/')) {
      return respond(JSON.stringify({ href: HREF }), url)
    }

    return respond(body, LANDED)
  })

const codeOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run()
  } catch (error) {
    return (error as LibError).code
  }

  return 'no-error'
}

describe('yadiskSource', () => {
  it('resolves a path through the public api and reads the landing address', async () => {
    const doFetch = chain('hello')

    const payload = await yadiskSource(INNER).get('text/dawn-song.md', 1000, { fetch: doFetch })

    expect(urlOf(doFetch.mock.calls[0]?.[0])).toContain(
      'public_key=https%3A%2F%2Fdisk.yandex.ru%2Fd%2FCtzap_DTvZ3xVQ',
    )
    expect(urlOf(doFetch.mock.calls[0]?.[0])).toContain('path=%2Ftext%2Fdawn-song.md')
    expect(new TextDecoder().decode(payload.bytes)).toBe('hello')
  })

  it('never reuses a resolved href, because it is pinned to a version of the file', async () => {
    const doFetch = chain('hello')
    const source = yadiskSource(INNER)

    await source.get('text/a.md', 1000, { fetch: doFetch })
    await source.get('text/a.md', 1000, { fetch: doFetch })

    const resolves = doFetch.mock.calls.filter((call) =>
      urlOf(call[0]).startsWith('https://cloud-api.yandex.net/'),
    )

    expect(resolves).toHaveLength(2)
  })

  it('maps a missing document to not-found', async () => {
    const doFetch = vi.fn(async (input: RequestInfo | URL) =>
      respond(
        JSON.stringify({ error: 'DiskNotFoundError', description: 'Resource not found.' }),
        urlOf(input),
        404,
      ),
    )

    expect(
      await codeOf(() => yadiskSource(INNER).get('text/nope.md', 1000, { fetch: doFetch })),
    ).toBe('not-found')
  })

  it('refuses a landing outside the storage hosts', async () => {
    const doFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = urlOf(input)

      if (url.startsWith('https://cloud-api.yandex.net/')) {
        return respond(JSON.stringify({ href: HREF }), url)
      }

      return respond('hello', 'https://evil.example.net/x')
    })

    expect(await codeOf(() => yadiskSource(INNER).get('text/a.md', 1000, { fetch: doFetch }))).toBe(
      'foreign-origin',
    )
  })

  it('has no direct address for a cover', () => {
    expect(yadiskSource(INNER).directUrl('pic/dawn-song.webp')).toBeNull()
  })

  it('spends one timeout across both legs, not one each', async () => {
    vi.useFakeTimers()

    try {
      const doFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = urlOf(input)

        if (url.startsWith('https://cloud-api.yandex.net/')) {
          // The resolve leg actually spends part of the clock (6s of a 10s
          // budget) so a mutant that hands the download leg a fresh full
          // budget instead of what is left can be told apart from the real
          // implementation: with the real one, 4s remain and the download
          // leg's own timeout fires by t=10s; with the mutant, it would not
          // fire until t=16s.
          return new Promise<Response>((resolve) => {
            setTimeout(() => resolve(respond(JSON.stringify({ href: HREF }), url)), 6_000)
          })
        }

        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
      })

      let settled = false
      let code = 'no-error'

      yadiskSource(INNER)
        .get('text/a.md', 1000, { fetch: doFetch, timeout: 10_000 })
        .then(
          () => {
            settled = true
          },
          (error: unknown) => {
            settled = true
            code = (error as LibError).code
          },
        )

      await vi.advanceTimersByTimeAsync(10_000)

      expect(settled).toBe(true)
      expect(code).toBe('timeout')
    } finally {
      vi.useRealTimers()
    }
  })

  it('refuses a resolve answer that names an address outside the storage hosts', async () => {
    const doFetch = vi.fn(async (input: RequestInfo | URL) =>
      respond(JSON.stringify({ href: 'https://evil.example.net/x' }), urlOf(input)),
    )

    expect(await codeOf(() => yadiskSource(INNER).get('text/a.md', 1000, { fetch: doFetch }))).toBe(
      'foreign-origin',
    )

    // The evil address must never be fetched: only the resolve call happens.
    expect(doFetch).toHaveBeenCalledTimes(1)
  })

  it("surfaces the caller's own cancellation as-is, not as a timeout", async () => {
    const controller = new AbortController()

    const doFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input)

      if (url.startsWith('https://cloud-api.yandex.net/')) {
        return respond(JSON.stringify({ href: HREF }), url)
      }

      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    })

    const run = yadiskSource(INNER).get('text/a.md', 1000, {
      fetch: doFetch,
      signal: controller.signal,
    })

    // Let the resolve leg finish and the download leg start before
    // cancelling, so the abort lands mid-flight rather than before any
    // fetch has begun.
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()

    let error: unknown

    try {
      await run
    } catch (caught) {
      error = caught
    }

    expect((error as { name?: string }).name).toBe('AbortError')
    expect((error as Partial<LibError>).code).not.toBe('timeout')
  })
})
