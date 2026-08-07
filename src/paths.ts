import { LibError } from './errors.js'
import { assertId } from './ids.js'

/**
 * The `${origin}${pathname}` rendering is only safe for a special scheme
 * (`https:` and friends), where the parser splits userinfo, host and path
 * into their own fields. For an opaque scheme — anything `URL` does not
 * recognise as special, including the `user:` a bare `user:pass@host/path`
 * parses as when a caller forgets the `https://` prefix — `origin` is the
 * literal string `"null"` and everything else, credentials included, has
 * landed in `pathname`. There is no safe rendering to fall back to in that
 * case, so callers must omit the `url` field entirely rather than guess one.
 */
function safeAddress(parsed: URL): string | undefined {
  return parsed.origin === 'null' ? undefined : `${parsed.origin}${parsed.pathname}`
}

/**
 * Refuses anything that is not a plain `https` URL: wrong scheme, or
 * credentials embedded in the address. This is the one check every address
 * handed to storage must pass — a catalogue, a base, a ref or a link in a
 * document — because it is also what keeps a secret from being sent over
 * plain http or logged back out of the address itself.
 */
export function assertHttps(url: string): URL {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    // Not parseable at all — there is no safe rendering to fall back to, and
    // guessing one risks echoing back whatever credentials the caller typed.
    // Drop the `url` field, and do not put the raw address in the message
    // either — a message reaches a log as readily as a field.
    throw new LibError('insecure-origin', 'Address is not a URL')
  }

  const safe = safeAddress(parsed)

  if (parsed.protocol !== 'https:') {
    throw new LibError('insecure-origin', `Address must use https, got ${parsed.protocol}`, {
      ...(safe === undefined ? {} : { url: safe }),
    })
  }

  if (parsed.username || parsed.password) {
    throw new LibError('insecure-origin', 'Address must not carry credentials', {
      ...(safe === undefined ? {} : { url: safe }),
    })
  }

  return parsed
}

/**
 * Normalises the base address of a lib: an https URL with no trailing slash,
 * no query string and no fragment (credentials are already refused by
 * `assertHttps` above). A query string or fragment would be silently
 * absorbed into every document path built from it (`{base}/feed.json`
 * becomes `{base}?x=1/feed.json`, or every document collapses to `{base}`
 * once a fragment is present) — unlike a catalogue, which lives at an
 * arbitrary address where a query string is legitimate.
 */
export function resolveBase(base: string): string {
  const parsed = assertHttps(base)
  const safe = safeAddress(parsed)

  if (parsed.search) {
    throw new LibError('insecure-origin', 'Base address must not carry a query string', {
      ...(safe === undefined ? {} : { url: safe }),
    })
  }

  if (parsed.hash) {
    throw new LibError('insecure-origin', 'Base address must not carry a fragment', {
      ...(safe === undefined ? {} : { url: safe }),
    })
  }

  return parsed.href.replace(/\/+$/, '')
}

export function aboutUrl(base: string): string {
  return `${resolveBase(base)}/about.json`
}

export function feedUrl(base: string): string {
  return `${resolveBase(base)}/feed.json`
}

export function bundleUrl(base: string, id: string): string {
  return `${resolveBase(base)}/bundles/${assertId(id, 'id')}.json`
}

export function textUrl(base: string, id: string): string {
  return `${resolveBase(base)}/text/${assertId(id, 'id')}.md`
}

export function picUrl(base: string, id: string): string {
  return `${resolveBase(base)}/pic/${assertId(id, 'id')}.webp`
}

export function testUrl(base: string, id: string): string {
  return `${resolveBase(base)}/test/${assertId(id, 'id')}.json`
}
