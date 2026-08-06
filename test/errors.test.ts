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

  it('returns the input as-is when it is not a URL', () => {
    expect(redactUrl('not a url', 'token')).toBe('not a url')
  })
})
