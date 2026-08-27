import { parseAddress } from './address.js'
import { decodeJson, fetchJson, type RequestOptions } from './fetch.js'
import {
  aboutPath,
  assertHttps,
  bundlePath,
  feedPath,
  picPath,
  testPath,
  textPath,
} from './paths.js'
import { sourceFor } from './sources/registry.js'
import type { Source } from './sources/types.js'
import type { About, Bundle, Feed, Libs, Test } from './types.js'
import { parseAbout } from './validate/about.js'
import { parseBundle } from './validate/bundle.js'
import { parseFeed } from './validate/feed.js'
import { parseLibs } from './validate/libs.js'
import { parseTest } from './validate/test.js'

export interface LibOptions extends RequestOptions {
  /** Manifests. The specification suggests 5 MB. */
  maxDocBytes?: number
  /** Readlet text. The specification suggests 1 MB. */
  maxTextBytes?: number
  /** Cover image. */
  maxPicBytes?: number
}

interface Call {
  signal?: AbortSignal
}

export interface Lib {
  readonly base: string
  about(call?: Call): Promise<About>
  feed(call?: Call): Promise<Feed>
  bundle(id: string, call?: Call): Promise<Bundle>
  text(id: string, call?: Call): Promise<string>
  test(id: string, call?: Call): Promise<Test>
  pic(id: string, call?: Call): Promise<Blob>
  /** A direct address for a document, or null when the source cannot offer one. */
  directUrl(path: string): string | null
}

const DEFAULT_DOC_BYTES = 5_000_000
const DEFAULT_TEXT_BYTES = 1_000_000
const DEFAULT_PIC_BYTES = 2_000_000

const withCall = (options: LibOptions, call?: Call): RequestOptions =>
  call?.signal ? { ...options, signal: call.signal } : options

/**
 * A subscription is a source and nothing more. Settings are given once,
 * here, so that the application does not thread them through every call.
 * `address` accepts either a plain address (resolved to a source through
 * the registry) or an already-prepared source, so a caller who built one
 * itself does not have to round-trip it through its own canonical string.
 */
export function openLib(address: string | Source, options: LibOptions = {}): Lib {
  const source = typeof address === 'string' ? sourceFor(parseAddress(address)) : address
  const docLimit = options.maxDocBytes ?? DEFAULT_DOC_BYTES
  const textLimit = options.maxTextBytes ?? DEFAULT_TEXT_BYTES
  const picLimit = options.maxPicBytes ?? DEFAULT_PIC_BYTES

  const json = async (path: string, call?: Call): Promise<unknown> => {
    const { bytes, safeUrl } = await source.get(path, docLimit, withCall(options, call))

    return decodeJson(bytes, safeUrl)
  }

  return {
    base: source.base,
    about: async (call) => parseAbout(await json(aboutPath(), call)),
    feed: async (call) => parseFeed(await json(feedPath(), call)),
    bundle: async (id, call) => parseBundle(await json(bundlePath(id), call)),
    test: async (id, call) => parseTest(await json(testPath(id), call)),

    async text(id, call) {
      const { bytes } = await source.get(textPath(id), textLimit, withCall(options, call))

      return new TextDecoder().decode(bytes)
    },

    async pic(id, call) {
      const { bytes, contentType } = await source.get(
        picPath(id),
        picLimit,
        withCall(options, call),
      )

      return new Blob([bytes], { type: contentType || 'image/webp' })
    },

    directUrl: (path) => source.directUrl(path),
  }
}

/**
 * A catalogue is not part of a lib's layout and lives at an arbitrary address,
 * so it is a function rather than a method.
 */
export async function fetchLibs(url: string, options: LibOptions = {}): Promise<Libs> {
  assertHttps(url)

  return parseLibs(await fetchJson(url, options.maxDocBytes ?? DEFAULT_DOC_BYTES, options))
}
