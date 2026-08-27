import type { Address } from '../address.js'
import { staticSource } from './static.js'
import type { Source } from './types.js'
import { yadiskSource } from './yadisk.js'

export function sourceFor(address: Address): Source {
  return address.kind === 'yadisk' ? yadiskSource(address.inner) : staticSource(address.inner)
}
