import { LibError } from './errors.js'
import { assertId } from './ids.js'

/**
 * Refuses anything that is not an `https` URL. This is the one check every
 * address handed to storage must pass — a catalogue, a base, a ref or a link
 * in a document — because it is also what keeps a secret from being sent over
 * plain http.
 */
export function assertHttps(url: string): URL {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new LibError('insecure-origin', `Address ${JSON.stringify(url)} is not a URL`, {
      url,
    })
  }

  if (parsed.protocol !== 'https:') {
    throw new LibError('insecure-origin', `Address must use https, got ${parsed.protocol}`, {
      url,
    })
  }

  return parsed
}

/**
 * Normalises the base address of a lib: an https URL with no trailing slash,
 * no query string, no fragment and no embedded credentials. A query string or
 * fragment would be silently absorbed into every document path built from it
 * (`{base}/feed.json` becomes `{base}?x=1/feed.json`, or every document
 * collapses to `{base}` once a fragment is present); credentials would reach
 * the error's `url` and browsers reject such URLs at `fetch` anyway.
 */
export function resolveBase(base: string): string {
  const parsed = assertHttps(base)

  if (parsed.username || parsed.password) {
    throw new LibError('insecure-origin', 'Base address must not carry credentials', {
      url: base,
    })
  }

  if (parsed.search) {
    throw new LibError('insecure-origin', 'Base address must not carry a query string', {
      url: base,
    })
  }

  if (parsed.hash) {
    throw new LibError('insecure-origin', 'Base address must not carry a fragment', {
      url: base,
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
