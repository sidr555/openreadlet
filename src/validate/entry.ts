import { assertId } from '../ids.js'
import type { ReadletEntry } from '../types.js'
import { asBoolean, asDate, asObject, asString, asTagIds, optionalDate } from './primitives.js'

/** The readlet entry is identical in about.json and in a bundle. */
export function parseEntry(raw: unknown, field: string): ReadletEntry {
  const source = asObject(raw, field)
  const updated = optionalDate(source['updated'], `${field}.updated`)

  const entry: ReadletEntry = {
    id: assertId(source['id'], `${field}.id`),
    title: asString(source['title'], `${field}.title`, 200),
    date: asDate(source['date'], `${field}.date`),
    tags: asTagIds(source['tags'], `${field}.tags`),
    text: asBoolean(source['text'], `${field}.text`, false),
    pic: asBoolean(source['pic'], `${field}.pic`, false),
    test: asBoolean(source['test'], `${field}.test`, false),
  }

  return updated === undefined ? entry : { ...entry, updated }
}
