import type { Address } from '../address.js'
import { LibError } from '../errors.js'
import { staticSource } from './static.js'
import type { Source } from './types.js'
import { yadiskSource } from './yadisk.js'

/**
 * Builds the source an address names.
 *
 * Deliberately a switch with an exhaustiveness check rather than a conditional with a
 * fallback: a new member of `SourceKind` that nobody wired up here must fail to compile,
 * not quietly become a static lib. The `never` binding is what enforces that — remove it
 * and the mistake becomes silent again, which is the one failure mode this function has.
 *
 * The runtime throw is for an `Address` that did not come from `parseAddress`, which is a
 * caller's mistake rather than a lib's. It reuses `insecure-origin`, the code an unknown
 * prefix already raises, rather than widening the error contract for a case no conforming
 * caller can reach.
 */
export function sourceFor(address: Address): Source {
  switch (address.kind) {
    case 'static':
      return staticSource(address.inner)
    case 'yadisk':
      return yadiskSource(address.inner)
    default: {
      const unknown: never = address.kind

      throw new LibError('insecure-origin', `Unknown source kind ${String(unknown)}`)
    }
  }
}
