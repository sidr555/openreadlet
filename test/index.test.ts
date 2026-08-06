import { describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '../src/index.js'

describe('package entry point', () => {
  it('declares the protocol version it speaks', () => {
    expect(PROTOCOL_VERSION).toBe('1.0')
  })
})
