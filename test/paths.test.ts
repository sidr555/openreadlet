import { describe, expect, it } from 'vitest'
import { LibError } from '../src/errors.js'
import {
  aboutPath,
  aboutUrl,
  assertHttps,
  bundlePath,
  bundleUrl,
  feedPath,
  feedUrl,
  picPath,
  resolveBase,
  testPath,
  testUrl,
  textPath,
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

  it('reports the safe form, not the raw base, when refusing a query string', () => {
    try {
      resolveBase('https://b.example.com/lib?X-Amz-Signature=DEADBEEFSIG&X-Amz-Credential=AKIA')
      expect.unreachable('resolveBase must throw')
    } catch (error) {
      expect((error as LibError).url).toBe('https://b.example.com/lib')
      expect((error as LibError).message).not.toContain('DEADBEEFSIG')
    }
  })

  it('reports the safe form, not the raw base, when refusing a fragment', () => {
    try {
      resolveBase(`${BASE}#s3cr3t-section`)
      expect.unreachable('resolveBase must throw')
    } catch (error) {
      expect((error as LibError).url).toBe(BASE)
      expect((error as LibError).message).not.toContain('s3cr3t-section')
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
      expect((error as LibError).message).not.toContain('s3.example.com/birds')
    }
  })

  it('does not echo the password when a non-special scheme puts it in the pathname', () => {
    try {
      assertHttps('admin:hunter2@libs.example.com/birds')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
      expect((error as LibError).url).toBeUndefined()
      expect((error as LibError).message).not.toContain('hunter2')
    }
  })

  it('never puts the raw address into the thrown message', () => {
    try {
      assertHttps('https://user:P4SS@')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).message).not.toContain('P4SS')
      expect((error as LibError).message).not.toContain('https://user:P4SS@')
    }
  })

  it('rejects a blob address without leaking the inner url it wraps', () => {
    // URL gives a blob: address the inner URL's origin while leaving the
    // whole inner URL - userinfo included - in pathname. The allowlist must
    // refuse this by scheme, not by trying to render it.
    try {
      assertHttps('blob:https://user:P4SS@h.example.com/x')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
      expect((error as LibError).url).toBeUndefined()
      expect((error as LibError).message).not.toContain('P4SS')
      expect((error as LibError).message).not.toContain('h.example.com')
    }
  })

  it('rejects a file address without leaking the path', () => {
    try {
      assertHttps('file:///etc/passwd')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
      expect((error as LibError).url).toBeUndefined()
      expect((error as LibError).message).not.toContain('/etc/passwd')
    }
  })

  it('still renders an ftp address with credentials stripped', () => {
    try {
      assertHttps('ftp://user:P4SS@h/p')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('insecure-origin')
      expect((error as LibError).url).toBe('ftp://h/p')
      expect((error as LibError).message).not.toContain('P4SS')
    }
  })

  it('still renders an https address with a query string when refusing embedded credentials', () => {
    try {
      assertHttps('https://user:pass@h/lib?sig=X')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).url).toBe('https://h/lib')
      expect((error as LibError).message).not.toContain('sig=X')
    }
  })

  it('names the field the address came from when refusing it', () => {
    try {
      assertHttps('s3.example.com/birds', 'libs[3].url')
      expect.unreachable('assertHttps must throw')
    } catch (error) {
      expect((error as LibError).field).toBe('libs[3].url')
    }
  })
})

describe('document addresses', () => {
  it('builds every path from the specification', () => {
    expect(aboutUrl(BASE)).toBe(`${BASE}/about.json`)
    expect(feedUrl(BASE)).toBe(`${BASE}/feed.json`)
    expect(bundleUrl(BASE, 'spring-2026')).toBe(`${BASE}/bundles/spring-2026.json`)
    expect(textUrl(BASE, 'dawn-song')).toBe(`${BASE}/text/dawn-song.md`)
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

describe('relative path builders', () => {
  it('builds every document path without a base', () => {
    expect(aboutPath()).toBe('about.json')
    expect(feedPath()).toBe('feed.json')
    expect(bundlePath('5-7')).toBe('bundles/5-7.json')
    expect(textPath('dawn-song')).toBe('text/dawn-song.md')
    expect(picPath('dawn-song')).toBe('pic/dawn-song.webp')
    expect(testPath('dawn-song')).toBe('test/dawn-song.json')
  })

  it('validates the identifier before it enters a path', () => {
    try {
      textPath('../../etc/passwd')
      expect.unreachable('textPath must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('bad-id')
    }
  })

  it('keeps the existing url builders working on top of them', () => {
    expect(textUrl(BASE, 'dawn-song')).toBe(`${BASE}/${textPath('dawn-song')}`)
  })
})
