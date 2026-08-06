import { assertId } from '../ids.js'
import type { Feed, FeedEntry } from '../types.js'
import { assertSupported } from '../version.js'
import { asAge, asArray, asDate, asObject, asTagIds, assertUniqueIds } from './primitives.js'

const parseFeedEntry = (raw: unknown, field: string): FeedEntry => {
  const source = asObject(raw, field)

  return {
    id: assertId(source['id'], `${field}.id`),
    updated: asDate(source['updated'], `${field}.updated`),
    age: asAge(source['age'], `${field}.age`),
    tags: asTagIds(source['tags'], `${field}.tags`),
  }
}

export function parseFeed(raw: unknown): Feed {
  const source = asObject(raw, 'feed')
  const ver = assertSupported(source['ver'])
  const bundles = asArray(source['bundles'], 'bundles').map((entry, index) =>
    parseFeedEntry(entry, `bundles[${index}]`),
  )

  assertUniqueIds(
    bundles.map((entry) => entry.id),
    'bundles',
  )

  return { ver, bundles }
}
