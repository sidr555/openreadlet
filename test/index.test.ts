import { describe, expect, it } from 'vitest'
import * as pkg from '../src/index.js'
import { openLib } from '../src/index.js'

describe('package entry point', () => {
  it('declares the protocol version it speaks', () => {
    expect(pkg.PROTOCOL_VERSION).toBe('1.0')
  })

  it('withdraws the standalone picUrl export', () => {
    expect('picUrl' in pkg).toBe(false)
  })

  it('carries the current address and path-building surface', () => {
    expect(pkg.aboutUrl).toBeTypeOf('function')
    expect(pkg.feedUrl).toBeTypeOf('function')
    expect(pkg.bundleUrl).toBeTypeOf('function')
    expect(pkg.textUrl).toBeTypeOf('function')
    expect(pkg.testUrl).toBeTypeOf('function')
    expect(pkg.parseAddress).toBeTypeOf('function')
    expect(pkg.staticSource).toBeTypeOf('function')
  })

  it('opens a lib from a static address with a working directUrl', () => {
    const lib = openLib('https://s3.example.com/birds')

    expect(lib.directUrl('pic/dawn-song.webp')).toBe(
      'https://s3.example.com/birds/pic/dawn-song.webp',
    )
  })
})
