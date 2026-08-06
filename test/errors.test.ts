import { describe, expect, it } from 'vitest'
import { LibError, redactUrl } from '../src/errors.js'

describe('LibError', () => {
  it('carries a stable code and the context of the failure', () => {
    const error = new LibError('too-large', 'Document is larger than 5000000 bytes', {
      url: 'https://s3.example.com/birds/feed.json',
      status: 200,
    })

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('LibError')
    expect(error.code).toBe('too-large')
    expect(error.url).toBe('https://s3.example.com/birds/feed.json')
    expect(error.status).toBe(200)
  })
})

describe('redactUrl', () => {
  it('hides the value of the named query parameter', () => {
    const url = 'https://libs.example.com/private/feed.json?token=s3cr3t'

    expect(redactUrl(url, 'token')).toBe(
      'https://libs.example.com/private/feed.json?token=***',
    )
  })

  it('returns the address untouched when no parameter is named', () => {
    const url = 'https://s3.example.com/birds/feed.json'

    expect(redactUrl(url)).toBe(url)
  })

  it('fails closed when the address is not a URL', () => {
    expect(redactUrl('not a url', 'token')).toBe('[redacted]')
  })

  it('does not leak the secret when the url has a malformed percent-escape', () => {
    const url = 'https://h/a%zz/f.json?token=s3cr3t'

    expect(redactUrl(url, 'token')).not.toContain('s3cr3t')
  })

  it('keeps an encoded slash in the path untouched', () => {
    const url = 'https://h/a%2Fb/f.json?token=s3cr3t'

    expect(redactUrl(url, 'token')).toBe('https://h/a%2Fb/f.json?token=***')
  })

  it('keeps the encoding of another query parameter untouched', () => {
    const url = 'https://h/f.json?q=hello%20world&token=s3cr3t'

    expect(redactUrl(url, 'token')).toBe('https://h/f.json?q=hello%20world&token=***')
  })

  it('fails closed when the secret name is escaped differently than a raw scan expects', () => {
    // URLSearchParams (what fetch.ts's prepare() uses to build the address)
    // percent-encodes '!' as part of application/x-www-form-urlencoded, while
    // encodeURIComponent leaves '!' untouched — a raw key comparison misses it.
    const url = 'https://s3.example.com/birds/about.json?key%21=S3CRET'

    expect(redactUrl(url, 'key!')).not.toContain('S3CRET')
  })

  it('fails closed when the secret name has a space, escaped as + by URLSearchParams', () => {
    const url = 'https://s3.example.com/birds/about.json?to+ken=S3CRET'

    expect(redactUrl(url, 'to ken')).not.toContain('S3CRET')
  })

  it('fails closed when the parser sees the name but a raw scan does not', () => {
    const url = 'https://h/f.json?%74oken=S3CRET'

    expect(redactUrl(url, 'token')).not.toContain('S3CRET')
  })

  it('redacts an empty parameter name instead of treating it as "no name given"', () => {
    const url = 'https://libs.example.com/about.json?=S3CRET'

    expect(redactUrl(url, '')).not.toContain('S3CRET')
  })

  it('does not leak the secret when the same name appears under two encodings', () => {
    const url = 'https://h/f.json?token=DECOY&%74oken=S3CRET'

    expect(redactUrl(url, 'token')).not.toContain('S3CRET')
  })

  it('strips userinfo from the success path along with the redacted query secret', () => {
    const url = 'https://user:P4SS@h/f.json?token=S3CRET'

    expect(redactUrl(url, 'token')).toBe('https://h/f.json?token=***')
  })

  it('strips userinfo even when no query parameter is named', () => {
    const url = 'https://user:P4SS@h/f.json'

    expect(redactUrl(url)).toBe('https://h/f.json')
  })

  it('strips userinfo when no secret parameter matches anything in the query', () => {
    const url = 'https://user:P4SS@h/f.json?other=1'

    expect(redactUrl(url, 'token')).not.toContain('P4SS')
  })
})
