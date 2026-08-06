import { fetchBlob, fetchJson, fetchText, type RequestOptions } from './fetch.js'
import {
  aboutUrl,
  assertHttps,
  bundleUrl,
  feedUrl,
  picUrl as buildPicUrl,
  resolveBase,
  testUrl,
  textUrl,
} from './paths.js'
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
  picUrl(id: string): string
}

const DEFAULT_DOC_BYTES = 5_000_000
const DEFAULT_TEXT_BYTES = 1_000_000
const DEFAULT_PIC_BYTES = 2_000_000

const withCall = (options: LibOptions, call?: Call): RequestOptions =>
  call?.signal ? { ...options, signal: call.signal } : options

/**
 * A subscription is a base address and nothing more. Settings are given once,
 * here, so that the application does not thread them through every call.
 */
export function openLib(base: string, options: LibOptions = {}): Lib {
  const root = resolveBase(base)
  const docLimit = options.maxDocBytes ?? DEFAULT_DOC_BYTES
  const textLimit = options.maxTextBytes ?? DEFAULT_TEXT_BYTES
  const picLimit = options.maxPicBytes ?? DEFAULT_PIC_BYTES

  return {
    base: root,

    async about(call) {
      return parseAbout(await fetchJson(aboutUrl(root), docLimit, withCall(options, call)))
    },

    async feed(call) {
      return parseFeed(await fetchJson(feedUrl(root), docLimit, withCall(options, call)))
    },

    async bundle(id, call) {
      return parseBundle(await fetchJson(bundleUrl(root, id), docLimit, withCall(options, call)))
    },

    async text(id, call) {
      return fetchText(textUrl(root, id), textLimit, withCall(options, call))
    },

    async test(id, call) {
      return parseTest(await fetchJson(testUrl(root, id), docLimit, withCall(options, call)))
    },

    async pic(id, call) {
      return fetchBlob(buildPicUrl(root, id), picLimit, withCall(options, call))
    },

    picUrl(id) {
      return buildPicUrl(root, id)
    },
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
