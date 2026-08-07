import { assertId } from '../ids.js'
import { assertHttps } from '../paths.js'
import type { About, LibRef, Tag } from '../types.js'
import { assertSupported } from '../version.js'
import { parseEntry } from './entry.js'
import {
  asAge,
  asArray,
  asObject,
  asString,
  assertUniqueIds,
  optionalString,
} from './primitives.js'

const parseTag = (raw: unknown, field: string): Tag => {
  const source = asObject(raw, field)

  return {
    id: assertId(source['id'], `${field}.id`),
    title: asString(source['title'], `${field}.title`, 120),
  }
}

const parseRef = (raw: unknown, field: string): LibRef => {
  const source = asObject(raw, field)
  const url = asString(source['url'], `${field}.url`)
  assertHttps(url, `${field}.url`)

  return {
    title: asString(source['title'], `${field}.title`, 120),
    url,
  }
}

export function parseAbout(raw: unknown): About {
  const source = asObject(raw, 'about')
  const ver = assertSupported(source['ver'])

  const tags = asArray(source['tags'] ?? [], 'tags').map((tag, index) =>
    parseTag(tag, `tags[${index}]`),
  )
  const readlets = asArray(source['readlets'] ?? [], 'readlets').map((entry, index) =>
    parseEntry(entry, `readlets[${index}]`),
  )
  const refs = asArray(source['refs'] ?? [], 'refs').map((ref, index) =>
    parseRef(ref, `refs[${index}]`),
  )

  assertUniqueIds(
    tags.map((tag) => tag.id),
    'tags',
  )
  assertUniqueIds(
    readlets.map((entry) => entry.id),
    'readlets',
  )

  const about: About = {
    ver,
    title: asString(source['title'], 'title', 120),
    age: asAge(source['age'], 'age'),
    tags,
    readlets,
    refs,
  }

  const description = optionalString(source['about'], 'about', 500)
  const author = optionalString(source['author'], 'author', 120)
  const contact = optionalString(source['contact'], 'contact', 200)

  return {
    ...about,
    ...(description === undefined ? {} : { about: description }),
    ...(author === undefined ? {} : { author }),
    ...(contact === undefined ? {} : { contact }),
  }
}
