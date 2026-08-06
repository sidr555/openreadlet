import { describe, expect, it } from 'vitest'
import { LibError } from '../src/errors.js'
import {
  aboutUrl,
  bundleUrl,
  feedUrl,
  picUrl,
  resolveBase,
  testUrl,
  textUrl,
} from '../src/paths.js'

const BASE = 'https://s3.example.com/birds'

describe('resolveBase', () => {
  it('drops trailing slashes', () => {
    expect(resolveBase('https://s3.example.com/birds///')).toBe(BASE)
  })

  it('rejects http', () => {
    try {
      resolveBase('http://s3.example.com/birds')
      expect.unreachable('resolveBase must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
    }
  })

  it('rejects an address that is not a URL', () => {
    expect(() => resolveBase('s3.example.com/birds')).toThrowError(LibError)
  })
})

describe('document addresses', () => {
  it('builds every path from the specification', () => {
    expect(aboutUrl(BASE)).toBe(`${BASE}/about.json`)
    expect(feedUrl(BASE)).toBe(`${BASE}/feed.json`)
    expect(bundleUrl(BASE, 'spring-2026')).toBe(`${BASE}/bundles/spring-2026.json`)
    expect(textUrl(BASE, 'dawn-song')).toBe(`${BASE}/text/dawn-song.md`)
    expect(picUrl(BASE, 'dawn-song')).toBe(`${BASE}/pic/dawn-song.webp`)
    expect(testUrl(BASE, 'dawn-song')).toBe(`${BASE}/test/dawn-song.json`)
  })

  it('refuses an identifier that would walk out of the base', () => {
    try {
      textUrl(BASE, '../../etc/passwd')
      expect.unreachable('textUrl must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('bad-id')
    }
  })
})
