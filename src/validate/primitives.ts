import { LibError } from '../errors.js'
import { assertId } from '../ids.js'
import type { Age } from '../types.js'

const fail = (field: string, what: string): never => {
  throw new LibError('schema-mismatch', `Field "${field}" ${what}`, { field })
}

export function asObject(raw: unknown, field: string): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail(field, 'must be an object')
  }

  return raw as Record<string, unknown>
}

export function asArray(raw: unknown, field: string): unknown[] {
  if (!Array.isArray(raw)) return fail(field, 'must be an array')

  return raw
}

export function asString(raw: unknown, field: string, max?: number): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    return fail(field, 'must be a non-empty string')
  }

  if (max !== undefined && raw.length > max) {
    return fail(field, `must be at most ${max} characters`)
  }

  return raw
}

export function optionalString(raw: unknown, field: string, max?: number): string | undefined {
  if (raw === undefined || raw === null) return undefined

  return asString(raw, field, max)
}

export function asBoolean(raw: unknown, field: string, fallback: boolean): boolean {
  if (raw === undefined || raw === null) return fallback
  if (typeof raw !== 'boolean') return fail(field, 'must be a boolean')

  return raw
}

export function asDate(raw: unknown, field: string): string {
  const value = asString(raw, field)

  if (Number.isNaN(Date.parse(value))) {
    return fail(field, 'must be an ISO 8601 date in UTC, e.g. 2026-06-17T01:45:02Z')
  }

  return value
}

export function optionalDate(raw: unknown, field: string): string | undefined {
  if (raw === undefined || raw === null) return undefined

  return asDate(raw, field)
}

const asAgeNumber = (raw: unknown, field: string): number => {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw > 120) {
    return fail(field, 'must be an integer between 0 and 120')
  }

  return raw
}

/**
 * Absent, null and [] all mean "no restriction". [7] is "7 and older",
 * [5, 7] is an inclusive range. More than two numbers, or a range that ends
 * before it starts, is a format error.
 */
export function asAge(raw: unknown, field: string): Age {
  if (raw === undefined || raw === null) return { min: 0, max: null }

  const values = asArray(raw, field)

  if (values.length === 0) return { min: 0, max: null }
  if (values.length > 2) return fail(field, 'must hold at most two numbers')

  const min = asAgeNumber(values[0], `${field}[0]`)

  if (values.length === 1) return { min, max: null }

  const max = asAgeNumber(values[1], `${field}[1]`)

  if (max < min) return fail(field, 'ends before it starts')

  return { min, max }
}

/**
 * Tags are identifiers, drawn from the same character set as an `id` — a tag
 * outside that set is a format error (`bad-id`), same as a malformed `id`
 * anywhere else. That is a different thing from a tag that is well-formed but
 * absent from `about.json`'s dictionary: an undeclared tag is still allowed
 * and must not sink the document, and this check does not touch that case.
 */
export function asTagIds(raw: unknown, field: string): string[] {
  if (raw === undefined || raw === null) return []

  return asArray(raw, field).map((value, index) => assertId(value, `${field}[${index}]`))
}

export function assertUniqueIds(ids: string[], field: string): void {
  const seen = new Set<string>()

  for (const id of ids) {
    if (seen.has(id)) {
      throw new LibError(
        'duplicate-id',
        `Field "${field}" holds ${JSON.stringify(id)} more than once`,
        { field },
      )
    }

    seen.add(id)
  }
}
