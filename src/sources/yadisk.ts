import { LibError } from '../errors.js'
import type { RequestOptions } from '../fetch.js'
import { httpGet } from './http.js'
import type { Source, SourcePayload } from './types.js'

const API = 'https://cloud-api.yandex.net/v1/disk/public/resources/download'

/** The api itself, and the sharded storage hosts a download lands on. */
const STORAGE = /^s\d+[a-z0-9]*\.storage\.yandex\.net$/

const apiLanding = (target: URL, landed: URL): boolean => target.origin === landed.origin

const downloadLanding = (_target: URL, landed: URL): boolean =>
  landed.protocol === 'https:' &&
  (STORAGE.test(landed.host) || landed.host === 'downloader.disk.yandex.ru')

/** The resolve answer is small; a cap is still applied rather than assumed. */
const RESOLVE_CAP = 64 * 1024

const DEFAULT_TIMEOUT = 10_000

/**
 * A public folder is read in two steps: ask the api for a download address,
 * then follow it. The address is never kept. It is pinned to a *version* of
 * a file, and a stale one answers 200 with the previous content — reusing it
 * would turn the protocol's update rule into silent staleness rather than a
 * visible failure.
 */
export function yadiskSource(inner: string): Source {
  const resolve = async (path: string, options: RequestOptions): Promise<string> => {
    const url = new URL(API)
    url.searchParams.set('public_key', inner)
    url.searchParams.set('path', `/${path}`)

    const { bytes, safeUrl } = await httpGet(url.href, RESOLVE_CAP, options, apiLanding)

    let answer: unknown

    try {
      answer = JSON.parse(new TextDecoder().decode(bytes))
    } catch (error) {
      throw new LibError('bad-json', 'The storage answered the resolve with invalid JSON', {
        url: safeUrl,
        cause: error,
      })
    }

    const href = (answer as { href?: unknown }).href

    if (typeof href !== 'string' || href === '') {
      throw new LibError('schema-mismatch', 'The resolve answer carries no href', {
        url: safeUrl,
      })
    }

    return href
  }

  return {
    base: `yadisk+${inner}`,
    allowsLanding: downloadLanding,

    async get(path: string, limit: number, options: RequestOptions): Promise<SourcePayload> {
      // httpGet's own timer is what a timeout is, and its own `signal` is
      // reserved for the caller's own cancellation — the two legs below must
      // not blur that by sharing a controller. Instead, one budget is split
      // across them by measurement: the download leg gets whatever the
      // resolve leg did not spend, so together they still spend one timeout
      // rather than one each. The caller's own `options.signal`, if any,
      // flows through to both legs untouched.
      const budget = options.timeout ?? DEFAULT_TIMEOUT
      const started = Date.now()

      const href = await resolve(path, { ...options, timeout: budget })

      // Clamped to a minimum of 1, not left able to reach zero or below: a
      // non-positive timeout would either fire before httpGet's own timer
      // logic ever arms it or be read as "no timeout" by a careless
      // implementation, either way losing the budget instead of spending
      // the last of it. A resolve that ate the whole budget still leaves the
      // download leg a timer, one that fires on the next tick, so the
      // caller gets 'timeout' right away rather than waiting out a second
      // full budget.
      const remaining = Math.max(1, budget - (Date.now() - started))

      return httpGet(href, limit, { ...options, timeout: remaining }, downloadLanding)
    },

    directUrl(): null {
      return null
    },
  }
}
