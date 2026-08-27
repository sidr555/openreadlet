import { describe, expect, it } from 'vitest'
import { parseAddress } from '../src/address.js'
import type { LibError } from '../src/errors.js'
import { sourceFor } from '../src/sources/registry.js'

const codeOf = (run: () => unknown): string => {
  try {
    run()
  } catch (error) {
    return (error as LibError).code
  }

  return 'no-error'
}

describe('parseAddress', () => {
  it('reads a bare https address as the static source', () => {
    expect(parseAddress('https://s3.example.com/birds/')).toEqual({
      kind: 'static',
      inner: 'https://s3.example.com/birds',
      canonical: 'https://s3.example.com/birds',
    })
  })

  it('reads a prefixed address as the named source', () => {
    expect(parseAddress('yadisk+https://disk.yandex.ru/d/Ctzap_DTvZ3xVQ')).toMatchObject({
      kind: 'yadisk',
      inner: 'https://disk.yandex.ru/d/Ctzap_DTvZ3xVQ',
    })
  })

  it('canonicalises the yadi.sk spelling to one subscription', () => {
    const short = parseAddress('yadisk+https://yadi.sk/d/Ctzap_DTvZ3xVQ/')
    const long = parseAddress('yadisk+https://disk.yandex.ru/d/Ctzap_DTvZ3xVQ')

    expect(short.canonical).toBe(long.canonical)
    expect(long.canonical).toBe('yadisk+https://disk.yandex.ru/d/Ctzap_DTvZ3xVQ')
  })

  it('refuses credentials smuggled inside the prefixed form', () => {
    expect(codeOf(() => parseAddress('yadisk+https://u:p@disk.yandex.ru/d/x'))).toBe(
      'insecure-origin',
    )
  })

  it('refuses an unknown prefix', () => {
    expect(codeOf(() => parseAddress('ftp+https://disk.yandex.ru/d/x'))).toBe('insecure-origin')
  })

  it('refuses http behind a known prefix', () => {
    expect(codeOf(() => parseAddress('yadisk+http://disk.yandex.ru/d/x'))).toBe('insecure-origin')
  })
})

describe('sourceFor', () => {
  it('resolves a bare address to a static source', () => {
    expect(sourceFor(parseAddress('https://s3.example.com/birds')).base).toBe(
      'https://s3.example.com/birds',
    )
  })

  it('resolves a yadisk-prefixed address to a yadisk source', () => {
    expect(sourceFor(parseAddress('yadisk+https://disk.yandex.ru/d/x')).base).toBe(
      'yadisk+https://disk.yandex.ru/d/x',
    )
  })
})
