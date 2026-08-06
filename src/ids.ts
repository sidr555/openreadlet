import { LibError } from './errors.js'

/**
 * 1 to 64 characters of A-Z a-z 0-9 _ - and nothing else. The identifier is
 * substituted into a URL path, so this check is the boundary between a reader
 * and a lib that tries to walk out of its own base address.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

export function isValidId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

export function assertId(value: unknown, field: string): string {
  if (!isValidId(value)) {
    throw new LibError(
      'bad-id',
      `Identifier ${JSON.stringify(value)} is not 1 to 64 characters of A-Z a-z 0-9 _ -`,
      { field },
    )
  }

  return value
}
