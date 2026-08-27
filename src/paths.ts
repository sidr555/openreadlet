import { LibError } from './errors.js'
import { assertId } from './ids.js'

/**
 * Schemes whose parser reliably splits userinfo, host and path into their
 * own fields, so `${origin}${pathname}` cannot smuggle credentials or a
 * whole inner URL along with it.
 *
 * This is an allowlist, not a denylist, on purpose: a denylist has to name
 * every unsafe scheme and keeps missing one — `blob:` is the newest, because
 * `URL` gives a `blob:` address the *inner* URL's origin while leaving the
 * whole inner URL, userinfo included, in `pathname`, so a check for
 * `origin === 'null'` sails straight past it. An allowlist means the next
 * unusual scheme someone invents fails closed by default, not by having
 * been enumerated here.
 */
export const SAFE_SCHEMES = new Set(['http:', 'https:', 'ftp:', 'ws:', 'wss:'])

/**
 * Only render an address when it has a non-empty host and a scheme known to
 * keep credentials and inner content out of `pathname`. Anything else —
 * `blob:`, `file:`, an opaque scheme, a scheme-relative address — has no
 * safe rendering to fall back to, so callers must omit the `url` field
 * entirely rather than guess one.
 */
function safeAddress(parsed: URL): string | undefined {
  if (!parsed.host) return undefined
  if (!SAFE_SCHEMES.has(parsed.protocol)) return undefined

  return `${parsed.origin}${parsed.pathname}`
}

/**
 * Refuses anything that is not a plain `https` URL: wrong scheme, or
 * credentials embedded in the address. This is the one check every address
 * handed to storage must pass — a catalogue, a base, a ref or a link in a
 * document — because it is also what keeps a secret from being sent over
 * plain http or logged back out of the address itself.
 *
 * `field` names the document field the address came from (`libs[3].url`,
 * `refs[1].url`), so a refusal in a fifty-entry catalogue points at the
 * entry that failed instead of leaving the caller to search for it — the
 * address itself is deliberately not in the error, so the field path is the
 * only thing left that locates the bad entry.
 */
export function assertHttps(url: string, field?: string): URL {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    // Not parseable at all — there is no safe rendering to fall back to, and
    // guessing one risks echoing back whatever credentials the caller typed.
    // Drop the `url` field, and do not put the raw address in the message
    // either — a message reaches a log as readily as a field.
    throw new LibError('insecure-origin', 'Address is not a URL', { field })
  }

  const safe = safeAddress(parsed)

  if (parsed.protocol !== 'https:') {
    throw new LibError('insecure-origin', `Address must use https, got ${parsed.protocol}`, {
      field,
      ...(safe === undefined ? {} : { url: safe }),
    })
  }

  if (parsed.username || parsed.password) {
    throw new LibError('insecure-origin', 'Address must not carry credentials', {
      field,
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

/**
 * Builds a relative path to `about.json` — the catalogue metadata.
 */
export function aboutPath(): string {
  return 'about.json'
}

/**
 * Builds a relative path to `feed.json` — the library feed.
 */
export function feedPath(): string {
  return 'feed.json'
}

/**
 * Builds a relative path to a bundle document, validating the identifier
 * before it enters the path. The identifier is a security boundary: it runs
 * once here, so callers never see an unvalidated path.
 */
export function bundlePath(id: string): string {
  return `bundles/${assertId(id, 'id')}.json`
}

/**
 * Builds a relative path to a text document, validating the identifier
 * before it enters the path. The identifier is a security boundary: it runs
 * once here, so callers never see an unvalidated path.
 */
export function textPath(id: string): string {
  return `text/${assertId(id, 'id')}.md`
}

/**
 * Builds a relative path to a picture document, validating the identifier
 * before it enters the path. The identifier is a security boundary: it runs
 * once here, so callers never see an unvalidated path.
 */
export function picPath(id: string): string {
  return `pic/${assertId(id, 'id')}.webp`
}

/**
 * Builds a relative path to a test document, validating the identifier
 * before it enters the path. The identifier is a security boundary: it runs
 * once here, so callers never see an unvalidated path.
 */
export function testPath(id: string): string {
  return `test/${assertId(id, 'id')}.json`
}

export function aboutUrl(base: string): string {
  return `${resolveBase(base)}/${aboutPath()}`
}

export function feedUrl(base: string): string {
  return `${resolveBase(base)}/${feedPath()}`
}

export function bundleUrl(base: string, id: string): string {
  return `${resolveBase(base)}/${bundlePath(id)}`
}

export function textUrl(base: string, id: string): string {
  return `${resolveBase(base)}/${textPath(id)}`
}

export function testUrl(base: string, id: string): string {
  return `${resolveBase(base)}/${testPath(id)}`
}
