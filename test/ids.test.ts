import { describe, expect, it } from 'vitest'
import { LibError } from '../src/errors.js'
import { assertId, isValidId } from '../src/ids.js'

describe('isValidId', () => {
  it.each(['dawn-song', 'spring_2026', 'a', 'A1', 'x'.repeat(64)])('accepts %s', (id) => {
    expect(isValidId(id)).toBe(true)
  })

  it.each([
    ['empty', ''],
    ['too long', 'x'.repeat(65)],
    ['parent directory', '../secret'],
    ['backslash', 'a\\b'],
    ['slash', 'a/b'],
    ['dot', 'a.b'],
    ['space', 'a b'],
    ['percent escape', '%2e%2e'],
  ])('rejects %s', (_name, id) => {
    expect(isValidId(id)).toBe(false)
  })

  it.each([undefined, null, 42, {}, ['dawn-song']])('rejects non-strings', (id) => {
    expect(isValidId(id)).toBe(false)
  })
})

describe('assertId', () => {
  it('returns the identifier when it is valid', () => {
    expect(assertId('dawn-song', 'readlets[0].id')).toBe('dawn-song')
  })

  it('throws bad-id naming the field', () => {
    try {
      assertId('../secret', 'readlets[0].id')
      expect.unreachable('assertId must throw')
    } catch (error) {
      expect(error).toBeInstanceOf(LibError)
      expect((error as LibError).code).toBe('bad-id')
      expect((error as LibError).field).toBe('readlets[0].id')
    }
  })
})
