import { assertHttps } from '../paths.js'
import type { CatalogueEntry, Libs } from '../types.js'
import { assertSupported } from '../version.js'
import { asAge, asArray, asObject, asString, optionalString } from './primitives.js'

const parseCatalogueEntry = (raw: unknown, field: string): CatalogueEntry => {
  const source = asObject(raw, field)
  const about = optionalString(source['about'], `${field}.about`, 500)
  const url = asString(source['url'], `${field}.url`)
  assertHttps(url)

  return {
    title: asString(source['title'], `${field}.title`, 120),
    url,
    age: asAge(source['age'], `${field}.age`),
    ...(about === undefined ? {} : { about }),
  }
}

export function parseLibs(raw: unknown): Libs {
  const source = asObject(raw, 'libs')
  const ver = assertSupported(source['ver'])
  const libs = asArray(source['libs'], 'libs').map((entry, index) =>
    parseCatalogueEntry(entry, `libs[${index}]`),
  )
  const title = optionalString(source['title'], 'title', 120)

  return { ver, libs, ...(title === undefined ? {} : { title }) }
}
