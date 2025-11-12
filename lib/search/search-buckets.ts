import type { SearchContentType } from "@/lib/search/search-params"

export const SEARCH_BUCKET_LIMITS_FOR_ALL: Record<Exclude<SearchContentType, "all">, number> = {
  posts: 16,
  activities: 12,
  users: 8,
  tags: 8,
}

