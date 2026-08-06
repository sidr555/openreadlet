import { LibError } from './errors.js'
import { assertId } from './ids.js'

/**
 * Normalises the base address of a lib: an https URL with no trailing slash.
 * Anything else is refused before a single byte leaves the device — which is
 * also what keeps a secret from being sent over plain http.
 */
export function resolveBase(base: string): string {
  let parsed: URL

  try {
    parsed = new URL(base)
  } catch {
    throw new LibError('insecure-origin', `Base address ${JSON.stringify(base)} is not a URL`, {
      url: base,
    })
  }

  if (parsed.protocol !== 'https:') {
    throw new LibError(
      'insecure-origin',
      `Base address must use https, got ${parsed.protocol}`,
      { url: base },
    )
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
