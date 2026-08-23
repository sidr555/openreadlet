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
  | 'storage-unavailable'
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
 * Strips userinfo (`user:pass@`) from between the scheme and the host of an
 * address, leaving everything else — including its encoding — untouched.
 * Works on the raw string rather than through `URL`, so it applies equally
 * to addresses that fail to parse: the authority section, if present, is
 * structural (`scheme://...@host`), not something that needs decoding to
 * find.
 */
function stripUserinfo(raw: string): string {
  return raw.replace(/^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/)[^/?#]*@/, '$1')
}

/**
 * `stripUserinfo`'s regex only recognises the `scheme://user:pass@host`
 * shape, so an opaque address (`user:pass@h/p`, no `//`), a scheme-relative
 * one (`//user:pass@h/p`) or one with a scheme `URL` treats as non-special
 * (`mailto:hunter2@x.com`) sails through it untouched, `@` and all. Once the
 * structural strip cannot apply, the only way to keep the promise that
 * nothing here carries credentials is to refuse to render the address at
 * all rather than guess at where the boundary between userinfo and host
 * would have been.
 */
function isUnsafeShape(address: string): boolean {
  if (!address.includes('@')) return false

  try {
    return new URL(address).host === ''
  } catch {
    return true
  }
}

/**
 * Replaces the value of a query parameter with `***`. A token passed in the
 * query string would otherwise reach the application log through the error.
 * Userinfo (`user:pass@`) is stripped unconditionally, whether or not a
 * parameter name is given, so the output never carries credentials
 * regardless of what it was given. When the address has a shape the strip
 * cannot apply to — opaque, scheme-relative, or a scheme `URL` treats as
 * non-special — it returns `'[redacted]'` instead of the input, rather than
 * let a credential in an unrecognised shape ride through unchanged.
 *
 * A secret placed in the URL **fragment** is not redacted — deliberately:
 * a fragment is never sent to a server and never appears in an address this
 * package builds itself, so it can only come from a caller's own URL, passed
 * in for redaction on its way to that caller's own log.
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
  const address = stripUserinfo(url)

  if (isUnsafeShape(address)) return '[redacted]'

  if (secretParam === undefined) return address

  let parsed: URL

  try {
    parsed = new URL(address)
  } catch {
    return '[redacted]'
  }

  try {
    const hashIndex = address.indexOf('#')
    const withoutHash = hashIndex === -1 ? address : address.slice(0, hashIndex)
    const hash = hashIndex === -1 ? '' : address.slice(hashIndex)
    const queryIndex = withoutHash.indexOf('?')

    if (queryIndex === -1) return address

    const beforeQuery = withoutHash.slice(0, queryIndex)
    const query = withoutHash.slice(queryIndex + 1)
    const encodedName = encodeURIComponent(secretParam)
    let matches = 0

    const redactedQuery = query
      .split('&')
      .map((pair) => {
        const eqIndex = pair.indexOf('=')
        const key = eqIndex === -1 ? pair : pair.slice(0, eqIndex)

        if (key !== encodedName) return pair

        matches += 1

        return `${key}=***`
      })
      .join('&')

    // A raw scan can miss occurrences of the parameter because of an
    // encoding mismatch — `URLSearchParams` (what `prepare()` in fetch.ts
    // uses) escapes `!`, spaces and other characters differently than
    // `encodeURIComponent` — or because the same decoded name appears twice
    // under two different encodings, so only one of them matches the raw
    // scan byte for byte. Ask the URL parser, which decodes properly, how
    // many occurrences it sees. Run this check every time, not only when the
    // raw scan found nothing, so a second, differently-encoded copy of the
    // secret can't ride along with the first one's redaction. If the parser
    // disagrees, the raw scan cannot be trusted to have redacted everything,
    // so fail closed rather than return output that still carries a secret.
    const decodedCount = parsed.searchParams.getAll(secretParam).length

    if (matches < decodedCount) {
      return `${parsed.origin}${parsed.pathname}?[redacted]`
    }

    if (matches === 0) return address

    return `${beforeQuery}?${redactedQuery}${hash}`
  } catch {
    return `${parsed.origin}${parsed.pathname}?[redacted]`
  }
}
