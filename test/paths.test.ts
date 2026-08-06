import { describe, expect, it } from 'vitest'
import { LibError } from '../src/errors.js'
import {
  aboutUrl,
  assertHttps,
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

  it('rejects a base carrying a query string', () => {
    try {
      resolveBase(`${BASE}?x=1`)
      expect.unreachable('resolveBase must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
    }
  })

  it('rejects a base carrying a fragment', () => {
    try {
      resolveBase(`${BASE}#section`)
      expect.unreachable('resolveBase must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
    }
  })

  it('rejects a base carrying credentials', () => {
    try {
      resolveBase('https://user:pass@s3.example.com/birds')
      expect.unreachable('resolveBase must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
    }
  })

  it('does not echo the password back when refusing a base carrying credentials', () => {
    try {
      resolveBase('https://user:pass@s3.example.com/birds')
      expect.unreachable('resolveBase must throw')
    } catch (error) {
      expect((error as LibError).url).not.toContain('pass')
    }
  })
})

describe('assertHttps', () => {
  it('returns the parsed URL for an https address', () => {
    expect(assertHttps(BASE).origin).toBe('https://s3.example.com')
  })

  it('rejects http', () => {
    try {
      assertHttps('http://s3.example.com/birds')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
    }
  })

  it('rejects an address that is not a URL', () => {
    expect(() => assertHttps('s3.example.com/birds')).toThrowError(LibError)
  })

  it('rejects an address carrying credentials', () => {
    try {
      assertHttps('https://user:pass@s3.example.com/birds')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
    }
  })

  it('accepts an address carrying a query string', () => {
    expect(assertHttps(`${BASE}?v=2`).search).toBe('?v=2')
  })

  it('does not echo the password back when refusing credentials', () => {
    try {
      assertHttps('https://user:pass@s3.example.com/birds')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).url).not.toContain('pass')
      expect((error as LibError).url).toBe('https://s3.example.com/birds')
    }
  })

  it('does not echo the password back when the scheme check is what trips', () => {
    try {
      assertHttps('http://user:pass@h/x')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).url).not.toContain('pass')
    }
  })

  it('reports the reason without a url when the address is not a URL at all', () => {
    try {
      assertHttps('s3.example.com/birds')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
      expect((error as LibError).url).toBeUndefined()
      expect((error as LibError).message).toContain('s3.example.com/birds')
    }
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
