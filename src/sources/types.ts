import type { RequestOptions } from '../fetch.js'

export interface SourcePayload {
  bytes: Uint8Array<ArrayBuffer>
  contentType: string
  /** Address with secrets already masked; this is what reaches LibError.url. */
  safeUrl: string
}

/** Which landing address a redirect may end at. Declared by each source. */
export type LandingPolicy = (target: URL, landed: URL) => boolean

export interface Source {
  readonly base: string
  get(path: string, limit: number, options: RequestOptions): Promise<SourcePayload>
  directUrl(path: string): string | null
}
