import { LibError } from './errors.js'
import { httpGet } from './sources/http.js'

/**
 * Reading a closed lib. The document format does not change: being closed is
 * a property of the transport, not of the protocol.
 */
export type Auth =
  | { type: 'basic'; user: string; password: string }
  | { type: 'bearer'; token: string }
  | { type: 'query'; name: string; value: string }

export interface RequestOptions {
  /** Milliseconds before the request is given up on. Defaults to 10 seconds. */
  timeout?: number
  fetch?: typeof globalThis.fetch
  auth?: Auth
  headers?: Record<string, string>
  signal?: AbortSignal
}

/** Every fetch in this module stays on the origin it started at. */
const sameOrigin = (target: URL, landed: URL): boolean => target.origin === landed.origin

const request = (
  url: string,
  limit: number,
  options: RequestOptions,
): ReturnType<typeof httpGet> => httpGet(url, limit, options, sameOrigin)

/**
 * Shared by every caller that turns raw bytes into a JSON document, so a
 * malformed body raises the same `bad-json` with the same redacted address
 * regardless of which transport fetched it.
 */
export function decodeJson(bytes: Uint8Array, safeUrl: string): unknown {
  const text = new TextDecoder().decode(bytes)

  try {
    return JSON.parse(text)
  } catch (error) {
    throw new LibError('bad-json', 'Document is not valid JSON', { url: safeUrl, cause: error })
  }
}

export async function fetchJson(
  url: string,
  limit: number,
  options: RequestOptions = {},
): Promise<unknown> {
  const { bytes, safeUrl } = await request(url, limit, options)

  return decodeJson(bytes, safeUrl)
}

export async function fetchText(
  url: string,
  limit: number,
  options: RequestOptions = {},
): Promise<string> {
  const { bytes } = await request(url, limit, options)

  return new TextDecoder().decode(bytes)
}

export async function fetchBlob(
  url: string,
  limit: number,
  options: RequestOptions = {},
): Promise<Blob> {
  const { bytes, contentType } = await request(url, limit, options)

  return new Blob([bytes], { type: contentType || 'image/webp' })
}
