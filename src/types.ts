import type { Version } from './version.js'

/** Normalised age range: `{ min: 0, max: null }` means no restriction. */
export interface Age {
  min: number
  max: number | null
}

export interface Tag {
  id: string
  title: string
}

export interface LibRef {
  title: string
  url: string
}

export interface ReadletEntry {
  id: string
  title: string
  date: string
  updated?: string
  tags: string[]
  text: boolean
  pic: boolean
  test: boolean
}

export interface About {
  ver: Version
  title: string
  about?: string
  author?: string
  contact?: string
  age: Age
  tags: Tag[]
  readlets: ReadletEntry[]
  refs: LibRef[]
}

export interface FeedEntry {
  id: string
  updated: string
  age: Age
  tags: string[]
}

export interface Feed {
  ver: Version
  bundles: FeedEntry[]
}

export interface Bundle {
  ver: Version
  readlets: ReadletEntry[]
}

export type QuestionType =
  'true-false' | 'choice' | 'multi-choice' | 'order' | 'blocks' | 'spot' | 'fill' | 'pairs'

interface QuestionBase {
  id: string
  question: string
  hint?: string
  points?: number
}

export type Question =
  | (QuestionBase & { type: 'true-false'; answer: boolean })
  | (QuestionBase & { type: 'choice'; items: string[]; answer: number })
  | (QuestionBase & { type: 'multi-choice'; items: string[]; answer: number[] })
  | (QuestionBase & { type: 'order'; items: string[]; answer: number[] })
  | (QuestionBase & { type: 'blocks'; items: string[]; answer: number[] })
  | (QuestionBase & { type: 'spot'; text: string; answer: number[] })
  | (QuestionBase & { type: 'fill'; answer: string })
  | (QuestionBase & { type: 'pairs'; pairs: [string, string][] })

export interface Test {
  ver: Version
  timer: string
  questions: Question[]
}

export interface CatalogueEntry {
  title: string
  url: string
  about?: string
  age: Age
}

export interface Libs {
  ver: Version
  title?: string
  libs: CatalogueEntry[]
}
