import { describe, expect, it } from 'vitest'
import { LibError } from '../src/errors.js'
import {
  asAge,
  asArray,
  asBoolean,
  asDate,
  asObject,
  asString,
  assertUniqueIds,
} from '../src/validate/primitives.js'

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return (error as LibError).code
  }

  return 'no-error'
}

describe('asAge', () => {
  it.each([
    ['absent', undefined],
    ['null', null],
    ['empty array', []],
  ])('treats %s as no restriction', (_name, raw) => {
    expect(asAge(raw, 'age')).toEqual({ min: 0, max: null })
  })

  it('reads a single number as "and older"', () => {
    expect(asAge([7], 'age')).toEqual({ min: 7, max: null })
  })

  it('reads a pair as an inclusive range', () => {
    expect(asAge([5, 7], 'age')).toEqual({ min: 5, max: 7 })
  })

  it.each([
    ['three numbers', [1, 2, 3]],
    ['range that ends before it starts', [7, 5]],
    ['out of bounds', [121]],
    ['negative', [-1]],
    ['fractional', [5.5]],
    ['string', ['5']],
    ['not an array', 5],
  ])('rejects %s', (_name, raw) => {
    expect(codeOf(() => asAge(raw, 'age'))).toBe('schema-mismatch')
  })
})

describe('asString', () => {
  it('returns the string', () => {
    expect(asString('Backyard Birds', 'title')).toBe('Backyard Birds')
  })

  it('rejects a string longer than the cap', () => {
    expect(codeOf(() => asString('x'.repeat(121), 'title', 120))).toBe('schema-mismatch')
  })

  it.each([undefined, null, 42, {}])('rejects %s', (raw) => {
    expect(codeOf(() => asString(raw, 'title'))).toBe('schema-mismatch')
  })
})

describe('asDate', () => {
  it('keeps a parsable ISO string', () => {
    expect(asDate('2026-06-17T01:45:02Z', 'date')).toBe('2026-06-17T01:45:02Z')
  })

  it.each(['yesterday', '2026-13-40T00:00:00Z', ''])('rejects %s', (raw) => {
    expect(codeOf(() => asDate(raw, 'date'))).toBe('schema-mismatch')
  })
})

describe('asObject, asArray, asBoolean', () => {
  it('reads what it is given', () => {
    expect(asObject({ a: 1 }, 'doc')).toEqual({ a: 1 })
    expect(asArray([1, 2], 'items')).toEqual([1, 2])
    expect(asBoolean(true, 'text', false)).toBe(true)
  })

  it('falls back for a missing boolean and refuses a wrong one', () => {
    expect(asBoolean(undefined, 'text', false)).toBe(false)
    expect(codeOf(() => asBoolean('yes', 'text', false))).toBe('schema-mismatch')
  })

  it.each([null, [], 'text'])('refuses %s as an object', (raw) => {
    expect(codeOf(() => asObject(raw, 'doc'))).toBe('schema-mismatch')
  })
})

describe('assertUniqueIds', () => {
  it('passes distinct identifiers', () => {
    expect(() => assertUniqueIds(['a', 'b'], 'readlets')).not.toThrow()
  })

  it('throws duplicate-id on a repeat', () => {
    expect(codeOf(() => assertUniqueIds(['a', 'b', 'a'], 'readlets'))).toBe('duplicate-id')
  })
})
