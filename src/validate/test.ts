import { LibError } from '../errors.js'
import type { Question, Test } from '../types.js'
import { assertSupported } from '../version.js'
import { asArray, asObject, asString, assertUniqueIds } from './primitives.js'

const asIndex = (raw: unknown, field: string, items: number): number => {
  if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0 || raw >= items) {
    throw new LibError(
      'schema-mismatch',
      `Field "${field}" must be an index into items, 0 to ${items - 1}`,
      { field },
    )
  }

  return raw
}

const asItems = (raw: unknown, field: string): string[] =>
  asArray(raw, field).map((item, index) => asString(item, `${field}[${index}]`))

const asIndexList = (raw: unknown, field: string, items: number): number[] =>
  asArray(raw, field).map((value, index) => asIndex(value, `${field}[${index}]`, items))

const parseQuestion = (raw: unknown, field: string): Question => {
  const source = asObject(raw, field)
  const base = {
    id: asString(source['id'], `${field}.id`, 64),
    question: asString(source['question'], `${field}.question`, 1000),
    ...(typeof source['hint'] === 'string' ? { hint: source['hint'] } : {}),
    ...(typeof source['points'] === 'number' ? { points: source['points'] } : {}),
  }
  const type = asString(source['type'], `${field}.type`)

  switch (type) {
    case 'true-false': {
      if (typeof source['answer'] !== 'boolean') {
        throw new LibError('schema-mismatch', `Field "${field}.answer" must be a boolean`, {
          field: `${field}.answer`,
        })
      }

      return { ...base, type, answer: source['answer'] }
    }

    case 'choice': {
      const items = asItems(source['items'], `${field}.items`)

      return {
        ...base,
        type,
        items,
        answer: asIndex(source['answer'], `${field}.answer`, items.length),
      }
    }

    case 'multi-choice':
    case 'order':
    case 'blocks': {
      const items = asItems(source['items'], `${field}.items`)

      return {
        ...base,
        type,
        items,
        answer: asIndexList(source['answer'], `${field}.answer`, items.length),
      }
    }

    case 'spot': {
      const text = asString(source['text'], `${field}.text`)

      return {
        ...base,
        type,
        text,
        answer: asIndexList(source['answer'], `${field}.answer`, text.split(/\s+/).length),
      }
    }

    case 'fill':
      return { ...base, type, answer: asString(source['answer'], `${field}.answer`) }

    case 'pairs': {
      const pairs = asArray(source['pairs'], `${field}.pairs`).map((pair, index) => {
        const values = asArray(pair, `${field}.pairs[${index}]`)

        if (values.length !== 2) {
          throw new LibError(
            'schema-mismatch',
            `Field "${field}.pairs[${index}]" must hold exactly two strings`,
            { field: `${field}.pairs[${index}]` },
          )
        }

        return [
          asString(values[0], `${field}.pairs[${index}][0]`),
          asString(values[1], `${field}.pairs[${index}][1]`),
        ] satisfies [string, string]
      })

      return { ...base, type, pairs }
    }

    default:
      throw new LibError(
        'schema-mismatch',
        `Field "${field}.type" holds an unknown question type ${JSON.stringify(type)}`,
        {
          field: `${field}.type`,
        },
      )
  }
}

export function parseTest(raw: unknown): Test {
  const source = asObject(raw, 'test')
  const ver = assertSupported(source['ver'])
  const questions = asArray(source['questions'], 'questions').map((question, index) =>
    parseQuestion(question, `questions[${index}]`),
  )

  assertUniqueIds(
    questions.map((question) => question.id),
    'questions',
  )

  return { ver, timer: asString(source['timer'], 'timer', 16), questions }
}
