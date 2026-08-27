import type { RequestOptions } from '../fetch.js'
import { httpGet } from './http.js'
import type { Source, SourcePayload } from './types.js'

const sameOrigin = (target: URL, landed: URL): boolean => target.origin === landed.origin

/**
 * A lib served as plain files under one origin. The behaviour of version 1.
 *
 * `inner` is trimmed of a trailing slash here, not only in `resolveBase`:
 * `parseAddress` always hands this a normalised address, but the function is
 * exported on its own, and a caller reaching it directly — say, to build a
 * `Source` for `openLib` without a round trip through a canonical string —
 * gets the same double-slash-free join either way.
 */
export function staticSource(inner: string): Source {
  const base = inner.replace(/\/+$/, '')

  return {
    base,
    allowsLanding: sameOrigin,

    get(path: string, limit: number, options: RequestOptions): Promise<SourcePayload> {
      return httpGet(`${base}/${path}`, limit, options, sameOrigin)
    },

    directUrl(path: string): string {
      return `${base}/${path}`
    },
  }
}
