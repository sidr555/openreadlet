import { LibError } from './errors.js'

export interface Version {
  major: number
  minor: number
}

/** The version this package speaks. */
export const SUPPORTED: Version = { major: 1, minor: 0 }

const VERSION_PATTERN = /^(\d+)\.(\d+)$/

export function parseVersion(raw: unknown, field = 'ver'): Version {
  if (typeof raw !== 'string') {
    throw new LibError(
      'schema-mismatch',
      `Field "${field}" must be a string of the form MAJOR.MINOR`,
      { field },
    )
  }

  const match = VERSION_PATTERN.exec(raw)

  if (!match?.[1] || !match[2]) {
    throw new LibError(
      'schema-mismatch',
      `Field "${field}" must be a string of the form MAJOR.MINOR, got ${JSON.stringify(raw)}`,
      { field },
    )
  }

  return { major: Number(match[1]), minor: Number(match[2]) }
}

/**
 * A different major means the document is not ours to read. A higher minor is
 * read normally — unknown fields are dropped by the validators, which is what
 * makes minor versions useful in the first place.
 */
export function assertSupported(raw: unknown): Version {
  const version = parseVersion(raw)

  if (version.major !== SUPPORTED.major) {
    throw new LibError(
      'unsupported-version',
      `Document speaks version ${version.major}.${version.minor}, this reader speaks ${SUPPORTED.major}.x`,
      { field: 'ver' },
    )
  }

  return version
}
