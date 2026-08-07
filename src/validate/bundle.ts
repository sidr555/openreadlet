import { assertSupported } from '../version.js'
import type { Bundle } from '../types.js'
import { parseEntry } from './entry.js'
import { asArray, asObject, assertUniqueIds } from './primitives.js'

export function parseBundle(raw: unknown): Bundle {
  const source = asObject(raw, 'bundle')
  const ver = assertSupported(source['ver'])
  const readlets = asArray(source['readlets'], 'readlets').map((entry, index) =>
    parseEntry(entry, `readlets[${index}]`),
  )

  assertUniqueIds(
    readlets.map((entry) => entry.id),
    'readlets',
  )

  return { ver, readlets }
}
