import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { LibError } from '../src/errors.js'
import { parseAbout } from '../src/validate/about.js'
import { parseBundle } from '../src/validate/bundle.js'
import { parseFeed } from '../src/validate/feed.js'
import { parseLibs } from '../src/validate/libs.js'
import { parseTest } from '../src/validate/test.js'

const load = (path: string): unknown =>
  JSON.parse(readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'))

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return (error as LibError).code
  }

  return 'no-error'
}

describe('the examples attached to the specification', () => {
  it('reads about.json', () => {
    const about = parseAbout(load('../examples/about.json'))

    expect(about.ver).toEqual({ major: 1, minor: 0 })
    expect(about.title).toBe('Backyard Birds')
    expect(about.readlets[0]?.id).toBe('dawn-song')
    expect(about.readlets[0]?.text).toBe(true)
  })

  it('reads feed.json and normalises age', () => {
    const feed = parseFeed(load('../examples/feed.json'))

    expect(feed.bundles.length).toBeGreaterThan(0)
    expect(feed.bundles.at(-1)?.age).toEqual({ min: 0, max: null })
  })

  it('reads a bundle', () => {
    expect(parseBundle(load('../examples/bundle.json')).readlets.length).toBeGreaterThan(0)
  })

  it('reads a quiz', () => {
    const test = parseTest(load('../examples/test.json'))

    expect(test.timer).toBe('3m')
    expect(test.questions[0]?.type).toBe('true-false')
  })

  it('reads a catalogue', () => {
    expect(parseLibs(load('../examples/libs.json')).libs[0]?.url).toMatch(/^https:\/\//)
  })
})

describe('documents that must be refused', () => {
  it.each([
    ['duplicate-id.json', 'duplicate-id'],
    ['escaping-id.json', 'bad-id'],
    ['foreign-major.json', 'unsupported-version'],
    ['bad-date.json', 'schema-mismatch'],
    ['no-version.json', 'schema-mismatch'],
  ])('bundle %s fails with %s', (file, code) => {
    expect(codeOf(() => parseBundle(load(`./fixtures/broken/${file}`)))).toBe(code)
  })

  it.each([
    ['age-three-numbers.json', 'schema-mismatch'],
    ['age-reversed.json', 'schema-mismatch'],
  ])('feed %s fails with %s', (file, code) => {
    expect(codeOf(() => parseFeed(load(`./fixtures/broken/${file}`)))).toBe(code)
  })

  it('refuses a ref that is not https', () => {
    const about = {
      ver: '1.0',
      title: 'Backyard Birds',
      refs: [{ title: 'Evil', url: 'javascript:alert(1)' }],
    }

    expect(codeOf(() => parseAbout(about))).toBe('insecure-origin')
  })

  it('refuses a catalogue entry that is not https', () => {
    const libs = {
      ver: '1.0',
      libs: [{ title: 'Backyard Birds', url: 'http://s3.example.com/birds' }],
    }

    expect(codeOf(() => parseLibs(libs))).toBe('insecure-origin')
  })
})

describe('documents that must be accepted', () => {
  it('reads a higher minor version', () => {
    const bundle = parseBundle({
      ver: '1.9',
      readlets: [{ id: 'dawn-song', title: 'Who sings', date: '2026-06-17T01:45:02Z' }],
    })

    expect(bundle.ver).toEqual({ major: 1, minor: 9 })
  })

  it('ignores an unknown field instead of refusing the document', () => {
    const bundle = parseBundle({
      ver: '1.0',
      mood: 'cheerful',
      readlets: [
        {
          id: 'dawn-song',
          title: 'Who sings',
          date: '2026-06-17T01:45:02Z',
          narrator: 'Anna',
        },
      ],
    })

    expect(bundle.readlets[0]?.id).toBe('dawn-song')
    expect('mood' in bundle).toBe(false)
    expect('narrator' in (bundle.readlets[0] ?? {})).toBe(false)
  })

  it('defaults the content flags to false', () => {
    const bundle = parseBundle({
      ver: '1.0',
      readlets: [{ id: 'quiet', title: 'No content', date: '2026-06-17T01:45:02Z' }],
    })

    expect(bundle.readlets[0]).toMatchObject({ text: false, pic: false, test: false, tags: [] })
  })
})
