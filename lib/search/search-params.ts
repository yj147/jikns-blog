import { endOfDay, startOfDay } from "date-fns"
import type { ReadonlyURLSearchParams } from "next/navigation"

export const SEARCH_CONTENT_TYPES = ["all", "posts", "activities", "users", "tags"] as const
export type SearchContentType = (typeof SEARCH_CONTENT_TYPES)[number]

export const SEARCH_SORT_OPTIONS = ["relevance", "latest"] as const
export type SearchSortOption = (typeof SEARCH_SORT_OPTIONS)[number]

export const SEARCH_SORT_OPTION_LABELS: Record<SearchSortOption, string> = {
  relevance: "相关度优先",
  latest: "最新发布",
}

export const MAX_SEARCH_TAG_IDS = 10
export const MAX_TAG_ID_LENGTH = 64

export type RawSearchParams = {
  q?: string | string[]
  type?: string | string[]
  page?: string | string[]
  authorId?: string | string[]
  tagIds?: string | string[]
  publishedFrom?: string | string[]
  publishedTo?: string | string[]
  onlyPublished?: string | string[]
  sort?: string | string[]
}

export type ParsedSearchParams = {
  query: string
  type: SearchContentType
  page: number
  authorId?: string
  tagIds?: string[]
  publishedFrom?: Date
  publishedTo?: Date
  onlyPublished: boolean
  sort: SearchSortOption
}

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type ParsedDateParam = {
  value?: Date
  isDateOnly: boolean
}

const getFirstValue = (value?: string | string[]) => {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

export const isSearchType = (value: string | undefined): value is SearchContentType => {
  return (SEARCH_CONTENT_TYPES as readonly string[]).includes(value ?? "")
}

export const resolveSearchType = (value?: string | string[]): SearchContentType => {
  const parsed = getFirstValue(value)
  return isSearchType(parsed) ? parsed : "all"
}

export const isSearchSortOption = (value: string | undefined): value is SearchSortOption => {
  return (SEARCH_SORT_OPTIONS as readonly string[]).includes(value ?? "")
}

export const resolveSearchSort = (value?: string | string[]): SearchSortOption => {
  const parsed = getFirstValue(value)
  return isSearchSortOption(parsed) ? parsed : "relevance"
}

export const parseTagIds = (value?: string | string[]): string[] | undefined => {
  if (!value) return undefined
  const rawValues = Array.isArray(value) ? value : [value]
  const tokens = rawValues
    .filter(Boolean)
    .flatMap((raw) => raw.split(","))
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && token.length <= MAX_TAG_ID_LENGTH)

  const uniqueTokens = Array.from(new Set(tokens))
  if (uniqueTokens.length === 0) {
    return undefined
  }

  return uniqueTokens.slice(0, MAX_SEARCH_TAG_IDS)
}

const parseDateParam = (value?: string | string[]): ParsedDateParam => {
  const raw = getFirstValue(value)
  if (!raw) {
    return { value: undefined, isDateOnly: false }
  }

  const isDateOnly = typeof raw === "string" && DATE_ONLY_PATTERN.test(raw)
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return { value: undefined, isDateOnly: false }
  }

  return { value: parsed, isDateOnly }
}

export const parseDateFromString = (value: string | null): Date | undefined => {
  return parseDateParam(value ?? undefined).value
}

const isSameTimestamp = (a?: Date, b?: Date) => {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}

const normalizeDateRange = (from?: Date, to?: Date) => {
  if (from && to && from > to) {
    return { from: to, to: from }
  }
  return { from, to }
}

export const buildUrlSearchParams = (input: Record<string, string | string[] | undefined>) => {
  const urlParams = new URLSearchParams()

  for (const [key, rawValue] of Object.entries(input)) {
    if (rawValue === undefined) continue
    if (Array.isArray(rawValue)) {
      rawValue
        .filter((item): item is string => Boolean(item))
        .forEach((item) => urlParams.append(key, item))
    } else {
      urlParams.set(key, rawValue)
    }
  }

  return urlParams
}

export const parseSearchParams = (input: RawSearchParams): ParsedSearchParams => {
  const query = (getFirstValue(input.q) ?? "").trim()
  const type = resolveSearchType(input.type)
  const pageNumber = parseInt(getFirstValue(input.page) ?? "1", 10)
  const page = Number.isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber
  const authorId = getFirstValue(input.authorId)
  const tagIds = parseTagIds(input.tagIds)

  const parsedFrom = parseDateParam(input.publishedFrom)
  const parsedTo = parseDateParam(input.publishedTo)
  const { from, to } = normalizeDateRange(parsedFrom.value, parsedTo.value)

  let publishedFrom = from
  let publishedTo = to

  if (publishedFrom) {
    const cameFromOriginalFrom = isSameTimestamp(publishedFrom, parsedFrom.value)
    const isDateOnly = cameFromOriginalFrom ? parsedFrom.isDateOnly : parsedTo.isDateOnly
    if (isDateOnly) {
      publishedFrom = startOfDay(publishedFrom)
    }
  }

  if (publishedTo) {
    const cameFromOriginalTo = isSameTimestamp(publishedTo, parsedTo.value)
    const isDateOnly = cameFromOriginalTo ? parsedTo.isDateOnly : parsedFrom.isDateOnly
    if (isDateOnly) {
      publishedTo = endOfDay(publishedTo)
    }
  }

  const onlyPublishedRaw = getFirstValue(input.onlyPublished)
  const onlyPublished = onlyPublishedRaw === undefined ? true : onlyPublishedRaw === "true"
  const sort = resolveSearchSort(input.sort)

  return {
    query,
    type,
    page,
    authorId,
    tagIds,
    publishedFrom,
    publishedTo,
    onlyPublished,
    sort,
  }
}

export const parseSearchParamsFromURL = (
  searchParams: URLSearchParams | ReadonlyURLSearchParams
): ParsedSearchParams => {
  const raw: RawSearchParams = {}

  searchParams.forEach((value, key) => {
    if (raw[key as keyof RawSearchParams] === undefined) {
      raw[key as keyof RawSearchParams] = value
    } else {
      const existing = raw[key as keyof RawSearchParams]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        raw[key as keyof RawSearchParams] = [existing as string, value]
      }
    }
  })

  return parseSearchParams(raw)
}
