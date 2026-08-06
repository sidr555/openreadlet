/** The protocol version this package implements. */
export const PROTOCOL_VERSION = '1.0'

export { LibError, redactUrl } from './errors.js'
export type { LibErrorCode, LibErrorInfo } from './errors.js'

export { isValidId } from './ids.js'
export {
  aboutUrl,
  assertHttps,
  bundleUrl,
  feedUrl,
  picUrl,
  resolveBase,
  testUrl,
  textUrl,
} from './paths.js'

export { parseVersion, SUPPORTED } from './version.js'
export type { Version } from './version.js'

export { parseAbout } from './validate/about.js'
export { parseBundle } from './validate/bundle.js'
export { parseFeed } from './validate/feed.js'
export { parseLibs } from './validate/libs.js'
export { parseTest } from './validate/test.js'

export {
  matchesAge,
  matchesTags,
  needsBundle,
  needsContent,
  pickBundles,
  staleReadlets,
} from './select.js'

export { fetchLibs, openLib } from './lib.js'
export type { Lib, LibOptions } from './lib.js'
export type { Auth, RequestOptions } from './fetch.js'

export type {
  About,
  Age,
  Bundle,
  CatalogueEntry,
  Feed,
  FeedEntry,
  Libs,
  LibRef,
  Question,
  QuestionType,
  ReadletEntry,
  Tag,
  Test,
} from './types.js'
