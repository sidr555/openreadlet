import { describe, expect, it } from 'vitest'
import type { Bundle, Feed, ReadletEntry } from '../src/types.js'
import {
  matchesAge,
  matchesTags,
  needsBundle,
  needsContent,
  pickBundles,
  staleReadlets,
} from '../src/select.js'

const entry = (over: Partial<ReadletEntry> = {}): ReadletEntry => ({
  id: 'dawn-song',
  title: 'Who sings before sunrise',
  date: '2026-06-17T01:45:02Z',
  tags: [],
  text: true,
  pic: false,
  test: false,
  ...over,
})

describe('matchesAge', () => {
  it.each([
    ['no restriction', { min: 0, max: null }, 4, true],
    ['and older, below', { min: 7, max: null }, 6, false],
    ['and older, at', { min: 7, max: null }, 7, true],
    ['range, inside', { min: 5, max: 7 }, 6, true],
    ['range, above', { min: 5, max: 7 }, 8, false],
  ] as const)('%s', (_name, age, readerAge, expected) => {
    expect(matchesAge(age, readerAge)).toBe(expected)
  })

  it('matches everything when the reader age is unknown', () => {
    expect(matchesAge({ min: 12, max: null })).toBe(true)
  })
})

describe('matchesTags', () => {
  it('takes a bundle sharing at least one selected tag', () => {
    expect(matchesTags(['songs', 'watching'], ['songs'])).toBe(true)
  })

  it('drops a bundle sharing none', () => {
    expect(matchesTags(['watching'], ['songs'])).toBe(false)
  })

  it('keeps an untagged bundle: selecting a tag must not cut off untagged content', () => {
    expect(matchesTags([], ['songs'])).toBe(true)
  })

  it('keeps everything when nothing is selected', () => {
    expect(matchesTags(['watching'], [])).toBe(true)
  })
})

describe('pickBundles', () => {
  const feed: Feed = {
    ver: { major: 1, minor: 0 },
    bundles: [
      { id: 'spring-2026', updated: '2026-06-17T01:45:02Z', age: { min: 3, max: 7 }, tags: ['songs'] },
      { id: 'archive', updated: '2026-02-01T09:00:00Z', age: { min: 12, max: null }, tags: [] },
      { id: 'misc', updated: '2026-01-05T12:30:00Z', age: { min: 0, max: null }, tags: ['watching'] },
    ],
  }

  it('filters by age and tags at once, keeping the publisher order', () => {
    expect(pickBundles(feed, { age: 6, tags: ['songs'] }).map((bundle) => bundle.id)).toEqual([
      'spring-2026',
    ])
  })

  it('returns everything that fits the age when no tag is selected', () => {
    expect(pickBundles(feed, { age: 6 }).map((bundle) => bundle.id)).toEqual([
      'spring-2026',
      'misc',
    ])
  })
})

describe('needsBundle and needsContent', () => {
  const feedEntry = {
    id: 'spring-2026',
    updated: '2026-06-17T01:45:02Z',
    age: { min: 0, max: null },
    tags: [],
  }

  it('downloads what was never stored', () => {
    expect(needsBundle(feedEntry)).toBe(true)
  })

  it('downloads when the feed is newer', () => {
    expect(needsBundle(feedEntry, '2026-06-16T00:00:00Z')).toBe(true)
  })

  it('skips when the stored copy is current', () => {
    expect(needsBundle(feedEntry, '2026-06-17T01:45:02Z')).toBe(false)
  })

  it('prefers the readlet own updated over the bundle one', () => {
    const readlet = entry({ updated: '2026-06-20T08:10:00Z' })

    expect(needsContent(readlet, '2026-06-17T01:45:02Z', '2026-06-18T00:00:00Z')).toBe(true)
  })

  it('falls back to the bundle updated when the readlet has none', () => {
    expect(needsContent(entry(), '2026-06-17T01:45:02Z', '2026-06-18T00:00:00Z')).toBe(false)
  })
})

describe('staleReadlets', () => {
  it('reports what disappeared from every bundle', () => {
    const bundles: Bundle[] = [
      { ver: { major: 1, minor: 0 }, readlets: [entry({ id: 'kept' })] },
      { ver: { major: 1, minor: 0 }, readlets: [entry({ id: 'kept' }), entry({ id: 'also-kept' })] },
    ]

    expect(staleReadlets(['kept', 'gone', 'also-kept'], bundles)).toEqual(['gone'])
  })
})
