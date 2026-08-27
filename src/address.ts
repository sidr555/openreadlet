import { LibError } from './errors.js'
import { resolveBase } from './paths.js'

export type SourceKind = 'static' | 'yadisk'

export interface Address {
  kind: SourceKind
  /** The https address the source works with, normalised. */
  inner: string
  /** The stored, deduplicating form of the subscription. */
  canonical: string
}

const PREFIXES: Record<string, SourceKind> = { yadisk: 'yadisk' }

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

/** Two spellings of one public folder must not become two subscriptions. */
const canonicaliseYadisk = (inner: string): string => {
  const parsed = new URL(inner)

  if (parsed.host === 'yadi.sk') parsed.host = 'disk.yandex.ru'

  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
}

/**
 * Canonicalisation is per-source behaviour, not something every prefixed
 * address gets alike: `yadisk` folds the `yadi.sk` short host into the long
 * one, but a future source would need its own rule, and running one
 * source's rule over another's address risks silently mangling it. Adding
 * a source means adding a branch here, not widening this one.
 */
const canonicaliseInner = (kind: SourceKind, inner: string): string => {
  if (kind === 'yadisk') return canonicaliseYadisk(inner)

  return inner
}

export function parseAddress(address: string): Address {
  const { name, rest } = split(address)

  if (name === null) {
    const inner = resolveBase(rest)

    return { kind: 'static', inner, canonical: inner }
  }

  const kind = PREFIXES[name]

  if (!kind) {
    throw new LibError('insecure-origin', `Unknown source prefix ${name}`)
  }

  const inner = canonicaliseInner(kind, resolveBase(rest))

  return { kind, inner, canonical: `${name}+${inner}` }
}
