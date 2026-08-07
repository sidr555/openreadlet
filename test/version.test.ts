import { describe, expect, it } from 'vitest'
import { LibError } from '../src/errors.js'
import { assertSupported, parseVersion, SUPPORTED } from '../src/version.js'

describe('parseVersion', () => {
  it('splits MAJOR.MINOR into numbers', () => {
    expect(parseVersion('1.0')).toEqual({ major: 1, minor: 0 })
    expect(parseVersion('2.13')).toEqual({ major: 2, minor: 13 })
  })

  it.each(['1', '1.0.0', 'v1.0', '', '1.x', ' 1.0'])('rejects %s', (raw) => {
    expect(() => parseVersion(raw)).toThrowError(LibError)
  })

  it('rejects a missing field with schema-mismatch', () => {
    try {
      parseVersion(undefined)
      expect.unreachable('parseVersion must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('schema-mismatch')
      expect((error as LibError).field).toBe('ver')
    }
  })
})

describe('assertSupported', () => {
  it('accepts the supported version', () => {
    expect(assertSupported('1.0')).toEqual(SUPPORTED)
  })

  it('accepts a higher minor: unknown fields are ignored, the document is read', () => {
    expect(assertSupported('1.7')).toEqual({ major: 1, minor: 7 })
  })

  it('rejects a foreign major', () => {
    try {
      assertSupported('2.0')
      expect.unreachable('assertSupported must throw')
    } catch (error) {
      expect((error as LibError).code).toBe('unsupported-version')
    }
  })
})
