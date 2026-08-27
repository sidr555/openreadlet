import { LibError, redactUrl } from '../errors.js'
import type { RequestOptions } from '../fetch.js'
import { SAFE_SCHEMES } from '../paths.js'
import type { LandingPolicy, SourcePayload } from './types.js'

/**
 * Exported so a source that must split one budget across more than one
 * `httpGet` call (yadisk's resolve-then-download) can default to the same
 * value `httpGet` itself falls back to, rather than duplicate the number —
 * a duplicate that would silently stop matching if this one ever moves.
 */
export const DEFAULT_TIMEOUT = 10_000

interface Prepared {
  target: string
  safeUrl: string
  headers: Record<string, string>
}

const encodeBasic = (user: string, password: string): string => {
  const bytes = new TextEncoder().encode(`${user}:${password}`)

  return btoa(String.fromCharCode(...bytes))
}

/**
 * Builds the `url` recorded on every error this module raises: strips
 * userinfo and masks the value of *every* query parameter, keeping the
 * parameter names — they are not secret, and are what makes an error
 * debuggable. Applied to the address as accepted, not only to one being
 * refused: a catalogue legitimately lives at an arbitrary address
 * (`fetchLibs` accepts a query string on purpose), so a presigned URL is a
 * supported input, and its signature must not ride into every later error
 * the way it would if only the auth-supplied parameter were masked.
 *
 * Deliberately not `redactUrl`: that helper preserves the caller's raw
 * encoding for a single named parameter, which is the wrong shape here —
 * every parameter needs masking, not one. `url` always parses by the time
 * it reaches `prepare()` (it is either the caller's own address, already
 * validated by `assertHttps`/`resolveBase`, or one this module just built
 * with `URLSearchParams`), but `redactUrl` is still the fallback if that
 * ever stops being true, rather than let an unparseable address through
 * unmasked.
 *
 * Guarded the same way `safeAddress` in `paths.ts` is: only proceeds past the
 * parse for a scheme in the shared `SAFE_SCHEMES` allowlist with a non-empty
 * host, and falls back to `redactUrl` otherwise, same as an address that does
 * not parse at all. A `blob:` address keeps its whole inner URL — userinfo
 * included — in `pathname`, where blanking `username`/`password` below is a
 * no-op, so without this guard the credential would ride through unmasked.
 *
 * The fragment is passed through unmasked, deliberately, same as in
 * `redactUrl`: a fragment is never sent to a server, so it cannot come from
 * an address this package builds.
 */
const buildSafeUrl = (url: string): string => {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return redactUrl(url)
  }

  if (!parsed.host || !SAFE_SCHEMES.has(parsed.protocol)) return redactUrl(url)

  parsed.username = ''
  parsed.password = ''

  const masked = new URLSearchParams()

  for (const key of parsed.searchParams.keys()) {
    masked.append(key, '***')
  }

  parsed.search = masked.toString()

  return parsed.href
}

const prepare = (url: string, options: RequestOptions): Prepared => {
  const headers = { ...(options.headers ?? {}) }
  const auth = options.auth

  if (!auth) return { target: url, safeUrl: buildSafeUrl(url), headers }

  if (auth.type === 'basic') {
    headers['Authorization'] = `Basic ${encodeBasic(auth.user, auth.password)}`

    return { target: url, safeUrl: buildSafeUrl(url), headers }
  }

  if (auth.type === 'bearer') {
    headers['Authorization'] = `Bearer ${auth.token}`

    return { target: url, safeUrl: buildSafeUrl(url), headers }
  }

  if (auth.name === '') {
    throw new LibError('insecure-origin', 'Query auth name must not be empty')
  }

  const withToken = new URL(url)
  withToken.searchParams.set(auth.name, auth.value)

  return {
    target: withToken.href,
    safeUrl: buildSafeUrl(withToken.href),
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

/** How much of a refusal's body is worth reading to find out what it says. */
const REFUSAL_CAP = 8 * 1024

/**
 * Storage-level reasons that mean the whole account is out rather than this one
 * document being closed: the account is suspended, disabled, or unpaid. S3 and its
 * compatibles answer a refusal with an `<Error>` document naming the reason, and
 * these are the reasons no reader can act on and no publisher chose.
 */
const STORAGE_OUT = new Set(['UserSuspended', 'AllAccessDisabled', 'AccountProblem'])

/**
 * Reads at most `REFUSAL_CAP` bytes of a response that is already known to be a
 * refusal. Nothing here may throw and nothing here may be slow: a body that is
 * missing, oversized, or unreadable simply carries no answer, and the refusal is
 * classified without it. Deliberately not `readCapped` — its `too-large` would
 * replace the refusal with a complaint about size.
 */
const peekRefusal = async (response: Response): Promise<string> => {
  try {
    const body = response.body

    if (!body) {
      const whole = await response.text()

      return whole.length > REFUSAL_CAP ? '' : whole
    }

    const reader = body.getReader()
    const decoder = new TextDecoder()
    let text = ''

    for (;;) {
      const { done, value } = await reader.read()

      if (done) return text
      if (!value) continue

      text += decoder.decode(value, { stream: true })

      if (text.length > REFUSAL_CAP) {
        await reader.cancel()

        return ''
      }
    }
  } catch {
    return ''
  }
}

/**
 * The `<Code>` of an S3-style `<Error>` document. One known field of one known
 * document, so a regular expression rather than an XML parser; anything that does
 * not look like that document yields '' and changes nothing.
 */
const refusalCode = (body: string): string =>
  /<Error\b[^>]*>[\s\S]*?<Code>\s*([A-Za-z]+)\s*<\/Code>/.exec(body)?.[1] ?? ''

/**
 * Everything a source needs to fetch a document safely: size cap, timeout,
 * abort forwarding, the CORS probe, address masking and error mapping stay
 * here in one hardened place. What differs between sources is only which
 * URL to call and which landing address a redirect may end at — supplied by
 * the caller as `allowsLanding`.
 */
export const httpGet = async (
  url: string,
  limit: number,
  options: RequestOptions,
  allowsLanding: LandingPolicy,
): Promise<SourcePayload> => {
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
        throw new LibError(
          'timeout',
          `No response within ${options.timeout ?? DEFAULT_TIMEOUT} ms`,
          {
            url: safeUrl,
            cause: error,
          },
        )
      }

      if (options.signal?.aborted) throw error

      const blocked = await looksBlocked(target, doFetch, controller.signal)

      // The shared timer can fire while the probe above is in flight; a
      // timeout that struck mid-probe is still a timeout, not a cors verdict.
      if (timedOut) {
        throw new LibError(
          'timeout',
          `No response within ${options.timeout ?? DEFAULT_TIMEOUT} ms`,
          {
            url: safeUrl,
            cause: error,
          },
        )
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

    let landedUrl: URL

    try {
      landedUrl = new URL(landed)
    } catch {
      // An unparseable landing address is not something to trust, and it must
      // not escape as a TypeError past the error contract.
      throw new LibError('foreign-origin', 'Request landed at an address that is not a URL', {
        url: safeUrl,
      })
    }

    if (!allowsLanding(new URL(target), landedUrl)) {
      throw new LibError('foreign-origin', `Request was redirected to ${landedUrl.origin}`, {
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
      // Told apart because they call for different things: a closed document is the
      // publisher's decision and stays closed until they change it, while a storage
      // that is out has nothing to do with them and is usually back within the hour.
      const out = STORAGE_OUT.has(refusalCode(await peekRefusal(response)))

      throw new LibError(
        out ? 'storage-unavailable' : 'forbidden',
        out
          ? 'The storage is not serving anything from this account'
          : 'The storage refuses to serve this document',
        { url: safeUrl, status: response.status },
      )
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
