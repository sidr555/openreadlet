import type { RequestOptions } from '../fetch.js'
import { httpGet } from './http.js'
import type { Source, SourcePayload } from './types.js'

const sameOrigin = (target: URL, landed: URL): boolean => target.origin === landed.origin

/** A lib served as plain files under one origin. The behaviour of version 1. */
export function staticSource(inner: string): Source {
  return {
    base: inner,
    allowsLanding: sameOrigin,

    get(path: string, limit: number, options: RequestOptions): Promise<SourcePayload> {
      return httpGet(`${inner}/${path}`, limit, options, sameOrigin)
    },

    directUrl(path: string): string {
      return `${inner}/${path}`
    },
  }
}
