import { LibError } from './errors.js'
import { assertHttps, resolveBase } from './paths.js'

export type SourceKind = 'static' | 'yadisk'

export interface Address {
  kind: SourceKind
  /** The https address the source works with, normalised. */
  inner: string
  /** The stored, deduplicating form of the subscription. */
  canonical: string
}

const PREFIXES: ReadonlyMap<string, SourceKind> = new Map([['yadisk', 'yadisk']])

/**
 * The prefix is split off by string, never by `URL`. An opaque scheme keeps
 * the whole inner address — userinfo included — in `pathname`, where an
 * origin check sails past it; the allowlist in `paths.ts` exists for that
 * reason and must keep seeing a plain https address.
 */
const split = (address: string): { name: string | null; rest: string } => {
  const plus = address.indexOf('+')
  const colon = address.indexOf(':')

  if (plus === -1 || (colon !== -1 && colon < plus)) return { name: null, rest: address }

  return { name: address.slice(0, plus), rest: address.slice(plus + 1) }
}

/**
 * Two spellings of one public folder must not become two subscriptions, and
 * a link pasted straight out of the Disk share dialog carries a query
 * string that must not force the publisher to edit it. Validation runs here
 * rather than through `resolveBase`, because `resolveBase` refuses a query
 * string outright — right for a plain https base, wrong for a Disk link
 * where `${origin}${pathname}` already drops it below.
 */
const canonicaliseYadisk = (rest: string): string => {
  const parsed = assertHttps(rest)

  if (parsed.host === 'yadi.sk') parsed.host = 'disk.yandex.ru'

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
}

/**
 * Canonicalisation is per-source behaviour, not something every prefixed
 * address gets alike: `yadisk` folds the `yadi.sk` short host into the long
 * one and drops a query string and fragment, but a future source would need
 * its own rule, and running one source's rule over another's address risks
 * silently mangling it. Adding a source means adding a branch here, not
 * widening this one.
 */
const canonicaliseInner = (kind: SourceKind, rest: string): string => {
  if (kind === 'yadisk') return canonicaliseYadisk(rest)

  return resolveBase(rest)
}

export function parseAddress(address: string): Address {
  const { name, rest } = split(address)

  if (name === null) {
    const inner = resolveBase(rest)

    return { kind: 'static', inner, canonical: inner }
  }

  const kind = PREFIXES.get(name)

  if (kind === undefined) {
    throw new LibError('insecure-origin', `Unknown source prefix ${name}`)
  }

  const inner = canonicaliseInner(kind, rest)

  return { kind, inner, canonical: `${name}+${inner}` }
}
