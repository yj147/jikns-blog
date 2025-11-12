import { z } from "zod"

import {
  SEARCH_CONTENT_TYPES,
  MAX_SEARCH_TAG_IDS,
  MAX_TAG_ID_LENGTH,
  SEARCH_SORT_OPTIONS,
  type SearchContentType,
} from "@/lib/search/search-params"
import type {
  SearchActivityResult,
  SearchPostResult,
  SearchTagResult,
  SearchUserResult,
} from "@/lib/repos/search"

export const SearchParamsSchema = z.object({
  query: z.string().min(1, "搜索关键词不能为空").max(100, "搜索关键词不能超过100个字符"),
  type: z.enum(SEARCH_CONTENT_TYPES).default("all"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
  sort: z.enum(SEARCH_SORT_OPTIONS).default("relevance"),
  authorId: z.string().optional(),
  tagIds: z.array(z.string().min(1).max(MAX_TAG_ID_LENGTH)).max(MAX_SEARCH_TAG_IDS).optional(),
  publishedFrom: z.date().optional(),
  publishedTo: z.date().optional(),
  onlyPublished: z.boolean().default(true),
})

export type SearchParams = z.infer<typeof SearchParamsSchema>

export interface SearchResultBucket<T> {
  items: T[]
  total: number
  hasMore: boolean
  page: number
  limit: number
}

export interface SearchResults {
  posts: SearchResultBucket<SearchPostResult>
  activities: SearchResultBucket<SearchActivityResult>
  users: SearchResultBucket<SearchUserResult>
  tags: SearchResultBucket<SearchTagResult>
  overallTotal: number
  query: string
  type: SearchContentType
}
