import { describe, expect, it, vi } from 'vitest'
import type { LibError } from '../src/errors.js'
import { fetchBlob, fetchJson, fetchText } from '../src/fetch.js'

const URL_FEED = 'https://s3.example.com/birds/feed.json'

const respond = (body: string, init: ResponseInit & { url?: string } = {}): Response => {
  const response = new Response(body, init)
  Object.defineProperty(response, 'url', { value: init.url ?? URL_FEED })

  return response
}

const codeOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run()
  } catch (error) {
    return (error as LibError).code
  }

  return 'no-error'
}

describe('fetchJson', () => {
  it('returns the parsed document', async () => {
    const doFetch = vi.fn(async () => respond('{"ver":"1.0"}'))

    await expect(fetchJson(URL_FEED, 5_000_000, { fetch: doFetch })).resolves.toEqual({
      ver: '1.0',
    })
  })

  it('reports bad-json on a truncated document', async () => {
    const doFetch = vi.fn(async () => respond('{ "ver": "1.0", "readlets": ['))

    expect(await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch }))).toBe('bad-json')
  })

  it('redacts the query token from the url on bad-json too', async () => {
    const doFetch = vi.fn(async () => respond('{ not json'))

    try {
      await fetchJson(URL_FEED, 5_000_000, {
        fetch: doFetch,
        auth: { type: 'query', name: 'token', value: 's3cr3t' },
      })
      expect.unreachable('fetchJson must throw')
    } catch (error) {
      expect((error as LibError).url).toContain('token=***')
      expect((error as LibError).url).not.toContain('s3cr3t')
    }
  })

  it.each([
    [404, 'not-found'],
    [403, 'forbidden'],
    [401, 'forbidden'],
    [500, 'http-error'],
  ])('maps status %i to %s', async (status, code) => {
    const doFetch = vi.fn(async () => respond('', { status }))

    expect(await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch }))).toBe(code)
  })

  it('refuses a redirect that left the origin', async () => {
    const doFetch = vi.fn(async () =>
      respond('{"ver":"1.0"}', { url: 'https://elsewhere.example.net/feed.json' }),
    )

    expect(await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch }))).toBe(
      'foreign-origin',
    )
  })

  it('refuses a document larger than the cap by its declared length', async () => {
    const doFetch = vi.fn(async () => respond('{}', { headers: { 'content-length': '9000000' } }))

    expect(await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch }))).toBe('too-large')
  })

  it('refuses a document that outgrows the cap while streaming', async () => {
    const doFetch = vi.fn(async () => respond('x'.repeat(2048)))

    expect(await codeOf(() => fetchJson(URL_FEED, 1024, { fetch: doFetch }))).toBe('too-large')
  })

  it('reports timeout when the response does not arrive in time', async () => {
    const doFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        }),
    )

    expect(
      await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch, timeout: 10 })),
    ).toBe('timeout')
  })

  it('reports cors-blocked when the plain request fails but a no-cors probe answers', async () => {
    const doFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.mode === 'no-cors') return respond('')

      throw new TypeError('Failed to fetch')
    })

    expect(await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch }))).toBe(
      'cors-blocked',
    )
  })

  it('reports timeout instead of hanging when the cors probe never settles', async () => {
    const doFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.mode === 'no-cors') {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'))
          })
        })
      }

      return Promise.reject(new TypeError('Failed to fetch'))
    })

    expect(
      await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch, timeout: 50 })),
    ).toBe('timeout')
  })

  it('surfaces the caller abort as its own error when it lands during the cors probe', async () => {
    const callerController = new AbortController()
    const doFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.mode === 'no-cors') {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'))
          })
          // the caller cancels only once the probe is already in flight
          setTimeout(() => callerController.abort(), 0)
        })
      }

      return Promise.reject(new TypeError('Failed to fetch'))
    })

    const promise = fetchJson(URL_FEED, 5_000_000, {
      fetch: doFetch,
      signal: callerController.signal,
    })

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('reports network-failed when nothing answers at all', async () => {
    const doFetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })

    expect(await codeOf(() => fetchJson(URL_FEED, 5_000_000, { fetch: doFetch }))).toBe(
      'network-failed',
    )
  })

  it('rejects immediately when the caller signal is already aborted', async () => {
    const doFetch = vi.fn(async () => respond('{"ver":"1.0"}'))

    await expect(
      fetchJson(URL_FEED, 5_000_000, { fetch: doFetch, signal: AbortSignal.abort() }),
    ).rejects.toBeDefined()

    expect(doFetch).not.toHaveBeenCalled()
  })

  it('surfaces the caller abort as its own error mid-flight, not a LibError', async () => {
    const controller = new AbortController()
    const doFetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'))
          })
        }),
    )

    const promise = fetchJson(URL_FEED, 5_000_000, { fetch: doFetch, signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('authentication', () => {
  it('sends basic credentials as a header', async () => {
    const doFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => respond('{}'))

    await fetchJson(URL_FEED, 5_000_000, {
      fetch: doFetch,
      auth: { type: 'basic', user: 'reader', password: 'open sesame' },
    })

    const init = doFetch.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(init.headers).get('authorization')).toBe(
      `Basic ${btoa('reader:open sesame')}`,
    )
  })

  it('sends a bearer token as a header', async () => {
    const doFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => respond('{}'))

    await fetchJson(URL_FEED, 5_000_000, {
      fetch: doFetch,
      auth: { type: 'bearer', token: 'abc' },
    })

    const init = doFetch.mock.calls[0]?.[1] as RequestInit
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer abc')
  })

  it('refuses an empty query auth name before the request goes out', async () => {
    const doFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => respond('{}'))

    await expect(
      fetchJson(URL_FEED, 5_000_000, {
        fetch: doFetch,
        auth: { type: 'query', name: '', value: 's3cr3t' },
      }),
    ).rejects.toMatchObject({ code: 'insecure-origin' })
    expect(doFetch).not.toHaveBeenCalled()
  })

  it('appends a query token and keeps it out of the error', async () => {
    const doFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      respond('', { status: 404 }),
    )

    try {
      await fetchJson(URL_FEED, 5_000_000, {
        fetch: doFetch,
        auth: { type: 'query', name: 'token', value: 's3cr3t' },
      })
      expect.unreachable('fetchJson must throw')
    } catch (error) {
      expect(String(doFetch.mock.calls[0]?.[0])).toContain('token=s3cr3t')
      expect((error as LibError).url).toContain('token=***')
      expect((error as LibError).url).not.toContain('s3cr3t')
    }
  })
})

describe('a presigned address is accepted input, not only refused input', () => {
  const PRESIGNED =
    'https://libs.example.com/catalogue.json?X-Amz-Signature=DEADBEEFSIG&X-Amz-Credential=AKIA'

  it('masks the signature on a plain request with no auth option', async () => {
    const doFetch = vi.fn(async () => respond('', { status: 404, url: PRESIGNED }))

    try {
      await fetchJson(PRESIGNED, 5_000_000, { fetch: doFetch })
      expect.unreachable('fetchJson must throw')
    } catch (error) {
      expect((error as LibError).url).toContain('X-Amz-Signature=***')
      expect((error as LibError).url).toContain('X-Amz-Credential=***')
      expect((error as LibError).url).not.toContain('DEADBEEFSIG')
      expect((error as LibError).url).not.toContain('AKIA')
    }
  })

  it('masks the signature under basic auth', async () => {
    const doFetch = vi.fn(async () => respond('', { status: 404, url: PRESIGNED }))

    try {
      await fetchJson(PRESIGNED, 5_000_000, {
        fetch: doFetch,
        auth: { type: 'basic', user: 'reader', password: 'open sesame' },
      })
      expect.unreachable('fetchJson must throw')
    } catch (error) {
      expect((error as LibError).url).toContain('X-Amz-Signature=***')
      expect((error as LibError).url).not.toContain('DEADBEEFSIG')
    }
  })

  it('masks the signature under bearer auth', async () => {
    const doFetch = vi.fn(async () => respond('', { status: 404, url: PRESIGNED }))

    try {
      await fetchJson(PRESIGNED, 5_000_000, {
        fetch: doFetch,
        auth: { type: 'bearer', token: 'abc' },
      })
      expect.unreachable('fetchJson must throw')
    } catch (error) {
      expect((error as LibError).url).toContain('X-Amz-Signature=***')
      expect((error as LibError).url).not.toContain('DEADBEEFSIG')
    }
  })

  it('masks both the signature and the appended token under query auth', async () => {
    const doFetch = vi.fn(async () => respond('', { status: 404, url: PRESIGNED }))

    try {
      await fetchJson(PRESIGNED, 5_000_000, {
        fetch: doFetch,
        auth: { type: 'query', name: 'token', value: 's3cr3t' },
      })
      expect.unreachable('fetchJson must throw')
    } catch (error) {
      expect((error as LibError).url).toContain('X-Amz-Signature=***')
      expect((error as LibError).url).toContain('token=***')
      expect((error as LibError).url).not.toContain('DEADBEEFSIG')
      expect((error as LibError).url).not.toContain('s3cr3t')
    }
  })
})

describe('an address of a non-special scheme is not gated before it reaches fetchJson', () => {
  it('does not carry the credential into the error, even though buildSafeUrl is internal', async () => {
    // Nothing between the caller and `fetchJson` validates the scheme — that
    // is `assertHttps`/`resolveBase`'s job, and only `openLib`/`fetchLibs`
    // call them. `URL` gives a `blob:` address the *inner* URL's origin while
    // leaving the whole inner URL, userinfo included, in `pathname`, so
    // stripping `username`/`password` off the parsed URL is a no-op here.
    const address = 'blob:https://u:P4SS@h/x'
    const doFetch = vi.fn(async () => respond('', { status: 404, url: address }))

    try {
      await fetchJson(address, 5_000_000, { fetch: doFetch })
      expect.unreachable('fetchJson must throw')
    } catch (error) {
      expect((error as LibError).url).not.toContain('P4SS')
      expect((error as LibError).url).not.toContain('u:P4SS@')
    }
  })
})

describe('fetchText and fetchBlob', () => {
  it('returns markdown untouched', async () => {
    const doFetch = vi.fn(async () => respond('# Who sings\n\nAt dawn.\n'))

    await expect(
      fetchText('https://s3.example.com/birds/text/dawn-song.md', 1_000_000, {
        fetch: doFetch,
      }),
    ).resolves.toBe('# Who sings\n\nAt dawn.\n')
  })

  it('returns the cover as a blob', async () => {
    const doFetch = vi.fn(async () =>
      respond('binary', { headers: { 'content-type': 'image/webp' } }),
    )

    const blob = await fetchBlob('https://s3.example.com/birds/pic/dawn-song.webp', 2_000_000, {
      fetch: doFetch,
    })

    expect(blob.type).toBe('image/webp')
    expect(blob.size).toBeGreaterThan(0)
  })
})
