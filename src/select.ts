import type { Age, Bundle, Feed, FeedEntry, ReadletEntry } from './types.js'

/** Unparsable date timestamps are treated as missing — download the content. */
function isValidStoredDate(timestamp: string): boolean {
  return !Number.isNaN(Date.parse(timestamp))
}

/** The reader age is matched against the bundle age, never against the lib age. */
export function matchesAge(age: Age, readerAge?: number): boolean {
  if (readerAge === undefined) return true
  if (readerAge < age.min) return false

  return age.max === null || readerAge <= age.max
}

/**
 * A bundle with no tags matches always: otherwise selecting a tag would
 * silently cut the reader off from every untagged bundle.
 */
export function matchesTags(bundleTags: string[], selected: string[]): boolean {
  if (selected.length === 0) return true
  if (bundleTags.length === 0) return true

  return bundleTags.some((tag) => selected.includes(tag))
}

export function pickBundles(
  feed: Feed,
  filter: { age?: number; tags?: string[] } = {},
): FeedEntry[] {
  const selected = filter.tags ?? []

  return feed.bundles.filter(
    (bundle) => matchesAge(bundle.age, filter.age) && matchesTags(bundle.tags, selected),
  )
}

export function needsBundle(entry: FeedEntry, storedUpdated?: string): boolean {
  if (storedUpdated === undefined) return true
  if (!isValidStoredDate(storedUpdated)) return true

  return Date.parse(entry.updated) > Date.parse(storedUpdated)
}

export function needsContent(
  readlet: ReadletEntry,
  bundleUpdated: string,
  storedUpdated?: string,
): boolean {
  if (storedUpdated === undefined) return true
  if (!isValidStoredDate(storedUpdated)) return true

  return Date.parse(readlet.updated ?? bundleUpdated) > Date.parse(storedUpdated)
}

/**
 * A readlet that has disappeared from every bundle is treated as deleted. Pass
 * every bundle the reader holds, not the output of `pickBundles` — a bundle
 * filtered out by age or tags is not one the reader has stopped holding, and
 * passing only the selected subset reports its readlets as deleted too.
 */
export function staleReadlets(storedIds: string[], bundles: Bundle[]): string[] {
  const live = new Set(bundles.flatMap((bundle) => bundle.readlets.map((entry) => entry.id)))

  return storedIds.filter((id) => !live.has(id))
}
