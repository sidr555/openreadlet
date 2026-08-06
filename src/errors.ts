/**
 * Stable failure codes. Applications branch on these; the human-facing wording
 * is theirs to write.
 */
export type LibErrorCode =
  // did not arrive
  | 'network-failed'
  | 'timeout'
  | 'insecure-origin'
  | 'foreign-origin'
  | 'cors-blocked'
  // arrived but wrong
  | 'not-found'
  | 'forbidden'
  | 'http-error'
  | 'too-large'
  | 'bad-json'
  // parsed and refused
  | 'schema-mismatch'
  | 'unsupported-version'
  | 'bad-id'
  | 'duplicate-id'

export interface LibErrorInfo {
  /** Address the failure happened at, with secrets already redacted. */
  url?: string
  /** Document field the failure points at, e.g. `readlets[2].age`. */
  field?: string
  /** HTTP status, when the response arrived at all. */
  status?: number
  cause?: unknown
}

export class LibError extends Error {
  readonly code: LibErrorCode
  readonly url: string | undefined
  readonly field: string | undefined
  readonly status: number | undefined

  constructor(code: LibErrorCode, message: string, info: LibErrorInfo = {}) {
    super(message, { cause: info.cause })
    this.name = 'LibError'
    this.code = code
    this.url = info.url
    this.field = info.field
    this.status = info.status
  }
}

/**
 * Replaces the value of a query parameter with `***`. A token passed in the
 * query string would otherwise reach the application log through the error.
 *
 * Rewrites only the named parameter's value in the raw query string, leaving
 * the rest of the URL — path, other parameters, their encoding — byte for
 * byte as given. Round-tripping through `URLSearchParams` would decode and
 * re-encode everything, which both changes the address reported in the error
 * and lets a malformed percent-escape throw past the redaction. On any
 * failure this fails closed: it never returns the input once a secret
 * parameter name has been given, because a failure to redact is not evidence
 * that there was nothing to redact.
 */
export function redactUrl(url: string, secretParam?: string): string {
  if (!secretParam) return url

  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    return '[redacted]'
  }

  try {
    const hashIndex = url.indexOf('#')
    const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
    const queryIndex = withoutHash.indexOf('?')

    if (queryIndex === -1) return url

    const beforeQuery = withoutHash.slice(0, queryIndex)
    const query = withoutHash.slice(queryIndex + 1)
    const encodedName = encodeURIComponent(secretParam)
    let found = false

    const redactedQuery = query
      .split('&')
      .map((pair) => {
        const eqIndex = pair.indexOf('=')
        const key = eqIndex === -1 ? pair : pair.slice(0, eqIndex)

        if (key !== encodedName) return pair

        found = true

        return `${key}=***`
      })
      .join('&')

    if (!found) return url

    return `${beforeQuery}?${redactedQuery}${hash}`
  } catch {
    return `${parsed.origin}${parsed.pathname}?[redacted]`
  }
}
