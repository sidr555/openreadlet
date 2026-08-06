import { LibError, redactUrl } from './errors.js'

/**
 * Reading a closed lib. The document format does not change: being closed is
 * a property of the transport, not of the protocol.
 */
export type Auth =
  | { type: 'basic'; user: string; password: string }
  | { type: 'bearer'; token: string }
  | { type: 'query'; name: string; value: string }

export interface RequestOptions {
  /** Milliseconds before the request is given up on. Defaults to 10 seconds. */
  timeout?: number
  fetch?: typeof globalThis.fetch
  auth?: Auth
  headers?: Record<string, string>
  signal?: AbortSignal
}

const DEFAULT_TIMEOUT = 10_000

interface Prepared {
  target: string
  safeUrl: string
  headers: Record<string, string>
}

const encodeBasic = (user: string, password: string): string => {
  const bytes = new TextEncoder().encode(`${user}:${password}`)

  return btoa(String.fromCharCode(...bytes))
}

const prepare = (url: string, options: RequestOptions): Prepared => {
  const headers = { ...(options.headers ?? {}) }
  const auth = options.auth

  if (!auth) return { target: url, safeUrl: url, headers }

  if (auth.type === 'basic') {
    headers['Authorization'] = `Basic ${encodeBasic(auth.user, auth.password)}`

    return { target: url, safeUrl: url, headers }
  }

  if (auth.type === 'bearer') {
    headers['Authorization'] = `Bearer ${auth.token}`

    return { target: url, safeUrl: url, headers }
  }

  const withToken = new URL(url)
  withToken.searchParams.set(auth.name, auth.value)

  return {
    target: withToken.href,
    safeUrl: redactUrl(withToken.href, auth.name),
    headers,
  }
}

/**
 * A failed fetch says nothing about why in a browser: a blocked read and a dead
 * network are the same TypeError. A no-cors probe tells them apart — an opaque
 * response means the server answered and it is the missing
 * Access-Control-Allow-Origin that stopped us.
 *
 * Takes the same signal as the request it is diagnosing, so the request's own
 * timeout aborts the probe too — otherwise a probe with nothing watching it
 * can hang long past the caller's `timeout`.
 */
const looksBlocked = async (
  target: string,
  doFetch: typeof globalThis.fetch,
  signal: AbortSignal,
): Promise<boolean> => {
  try {
    await doFetch(target, { mode: 'no-cors', redirect: 'follow', credentials: 'omit', signal })

    return true
  } catch {
    return false
  }
}

const readCapped = async (
  response: Response,
  limit: number,
  safeUrl: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const declared = Number(response.headers.get('content-length'))

  if (Number.isFinite(declared) && declared > limit) {
    throw new LibError('too-large', `Response declares ${declared} bytes, cap is ${limit}`, {
      url: safeUrl,
      status: response.status,
    })
  }

  const body = response.body

  if (!body) {
    const buffer = new Uint8Array(await response.arrayBuffer())

    if (buffer.byteLength > limit) {
      throw new LibError('too-large', `Response is larger than ${limit} bytes`, { url: safeUrl })
    }

    return buffer
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) break
    if (!value) continue

    total += value.byteLength

    if (total > limit) {
      await reader.cancel()
      throw new LibError('too-large', `Response is larger than ${limit} bytes`, { url: safeUrl })
    }

    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

interface Payload {
  bytes: Uint8Array<ArrayBuffer>
  contentType: string
  safeUrl: string
}

const request = async (
  url: string,
  limit: number,
  options: RequestOptions,
): Promise<Payload> => {
  const doFetch = options.fetch ?? globalThis.fetch
  const { target, safeUrl, headers } = prepare(url, options)
  const controller = new AbortController()
  let timedOut = false

  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeout ?? DEFAULT_TIMEOUT)

  const forward = (): void => controller.abort()

  if (options.signal?.aborted) {
    controller.abort()
  } else {
    options.signal?.addEventListener('abort', forward, { once: true })
  }

  try {
    let response: Response

    try {
      if (controller.signal.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError')
      }

      response = await doFetch(target, {
        method: 'GET',
        headers,
        redirect: 'follow',
        credentials: 'omit',
        signal: controller.signal,
      })
    } catch (error) {
      if (timedOut) {
        throw new LibError('timeout', `No response within ${options.timeout ?? DEFAULT_TIMEOUT} ms`, {
          url: safeUrl,
          cause: error,
        })
      }

      if (options.signal?.aborted) throw error

      const blocked = await looksBlocked(target, doFetch, controller.signal)

      // The shared timer can fire while the probe above is in flight; a
      // timeout that struck mid-probe is still a timeout, not a cors verdict.
      if (timedOut) {
        throw new LibError('timeout', `No response within ${options.timeout ?? DEFAULT_TIMEOUT} ms`, {
          url: safeUrl,
          cause: error,
        })
      }

      // Likewise, the caller's own signal can abort while the probe is in
      // flight. That is their cancellation, not evidence of CORS or the
      // network — surface it as their AbortError, not a LibError.
      if (options.signal?.aborted) {
        throw options.signal.reason ?? new DOMException('This operation was aborted', 'AbortError')
      }

      if (blocked) {
        throw new LibError(
          'cors-blocked',
          'The storage answered but did not allow reading it from a browser: no Access-Control-Allow-Origin',
          { url: safeUrl, cause: error },
        )
      }

      throw new LibError('network-failed', 'Request failed before a response arrived', {
        url: safeUrl,
        cause: error,
      })
    }

    // A custom `fetch` that returns a synthetic `Response` (as tests here do)
    // may leave `url` at its default of `''` — there is no landing address to
    // compare, so the redirect check below cannot fire for it. A real fetch
    // in a browser always sets `response.url`, redirected or not.
    const landed = response.url === '' ? target : response.url

    if (new URL(landed).origin !== new URL(target).origin) {
      throw new LibError('foreign-origin', `Request was redirected to ${new URL(landed).origin}`, {
        url: safeUrl,
      })
    }

    if (response.status === 404) {
      throw new LibError('not-found', 'No such document in the lib', {
        url: safeUrl,
        status: 404,
      })
    }

    if (response.status === 401 || response.status === 403) {
      throw new LibError('forbidden', 'The storage refuses to serve this document', {
        url: safeUrl,
        status: response.status,
      })
    }

    if (!response.ok) {
      throw new LibError('http-error', `Storage answered with ${response.status}`, {
        url: safeUrl,
        status: response.status,
      })
    }

    return {
      bytes: await readCapped(response, limit, safeUrl),
      contentType: response.headers.get('content-type') ?? '',
      safeUrl,
    }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', forward)
  }
}

export async function fetchJson(
  url: string,
  limit: number,
  options: RequestOptions = {},
): Promise<unknown> {
  const { bytes, safeUrl } = await request(url, limit, options)
  const text = new TextDecoder().decode(bytes)

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new LibError('bad-json', 'Document is not valid JSON', {
      url: safeUrl,
      cause: error,
    })
  }
}

export async function fetchText(
  url: string,
  limit: number,
  options: RequestOptions = {},
): Promise<string> {
  const { bytes } = await request(url, limit, options)

  return new TextDecoder().decode(bytes)
}

export async function fetchBlob(
  url: string,
  limit: number,
  options: RequestOptions = {},
): Promise<Blob> {
  const { bytes, contentType } = await request(url, limit, options)

  return new Blob([bytes], { type: contentType || 'image/webp' })
}
