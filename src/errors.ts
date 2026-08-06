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
 */
export function redactUrl(url: string, secretParam?: string): string {
  if (!secretParam) return url

  try {
    const parsed = new URL(url)
    if (!parsed.searchParams.has(secretParam)) return url
    parsed.searchParams.set(secretParam, '***')
    return decodeURIComponent(parsed.href)
  } catch {
    return url
  }
}
