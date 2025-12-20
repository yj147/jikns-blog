"use client"

import { useCallback, useMemo, useRef, useState } from "react"

export type PinnedFilter = "all" | "pinned" | "unpinned"

export interface FeedFiltersValue {
  search: string
  authorId: string
  pinned: PinnedFilter
  includeDeleted: boolean
  dateFrom: string | null
  dateTo: string | null
}

export interface UseFeedFiltersOptions {
  initialFilters?: Partial<FeedFiltersValue>
  initialPage?: number
  initialLimit?: number
}

export interface FeedQueryParams {
  page: number
  limit: number
  q?: string
  authorId?: string
  isPinned?: boolean
  includeDeleted?: boolean
  dateFrom?: string
  dateTo?: string
}

const DEFAULT_LIMIT = 20

const DEFAULT_FILTERS: FeedFiltersValue = {
  search: "",
  authorId: "",
  pinned: "all",
  includeDeleted: false,
  dateFrom: null,
  dateTo: null,
}

export function useFeedFilters(options?: UseFeedFiltersOptions) {
  const initialFiltersRef = useRef<FeedFiltersValue>({
    ...DEFAULT_FILTERS,
    ...options?.initialFilters,
  })
  const initialPageRef = useRef(options?.initialPage ?? 1)
  const initialLimitRef = useRef(options?.initialLimit ?? DEFAULT_LIMIT)

  const [filters, setFiltersState] = useState<FeedFiltersValue>(initialFiltersRef.current)
  const [page, setPageState] = useState(initialPageRef.current)
  const [limit, setLimitState] = useState(initialLimitRef.current)

  const setFilters = useCallback(
    (updater: Partial<FeedFiltersValue> | ((prev: FeedFiltersValue) => FeedFiltersValue)) => {
      setFiltersState((prev) =>
        typeof updater === "function" ? updater(prev) : { ...prev, ...updater }
      )
      setPageState(1)
    },
    []
  )

  const setSearch = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, search: value.slice(0, 100) }))
    },
    [setFilters]
  )

  const setAuthorId = useCallback(
    (value: string) => {
      setFilters((prev) => ({ ...prev, authorId: value.trim() }))
    },
    [setFilters]
  )

  const setPinned = useCallback(
    (value: PinnedFilter) => {
      setFilters((prev) => ({ ...prev, pinned: value }))
    },
    [setFilters]
  )

  const setIncludeDeleted = useCallback(
    (value: boolean) => {
      setFilters((prev) => ({ ...prev, includeDeleted: value }))
    },
    [setFilters]
  )

  const setDateRange = useCallback(
    (from: string | null, to: string | null) => {
      let nextFrom = from ? from : null
      let nextTo = to ? to : null

      if (nextFrom && nextTo && nextFrom > nextTo) {
        const temp = nextFrom
        nextFrom = nextTo
        nextTo = temp
      }

      setFilters((prev) => ({ ...prev, dateFrom: nextFrom, dateTo: nextTo }))
    },
    [setFilters]
  )

  const resetFilters = useCallback(() => {
    setFiltersState(initialFiltersRef.current)
    setPageState(initialPageRef.current)
    setLimitState(initialLimitRef.current)
  }, [])

  const setPage = useCallback((nextPage: number) => {
    setPageState((prev) => {
      if (nextPage < 1) return prev
      return nextPage
    })
  }, [])

  const setLimit = useCallback((nextLimit: number) => {
    const safeLimit = Math.min(Math.max(Math.floor(nextLimit), 5), 100)
    setLimitState(safeLimit)
    setPageState(1)
  }, [])

  const queryParams = useMemo<FeedQueryParams>(() => {
    const params: FeedQueryParams = {
      page,
      limit,
    }

    const trimmedSearch = filters.search.trim()
    if (trimmedSearch) params.q = trimmedSearch
    if (filters.authorId) params.authorId = filters.authorId
    if (filters.pinned === "pinned") params.isPinned = true
    if (filters.pinned === "unpinned") params.isPinned = false
    if (filters.includeDeleted) params.includeDeleted = true
    if (filters.dateFrom) params.dateFrom = filters.dateFrom
    if (filters.dateTo) params.dateTo = filters.dateTo

    return params
  }, [filters, page, limit])

  const queryString = useMemo(() => {
    const searchParams = new URLSearchParams()
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, String(value))
      }
    })
    return searchParams.toString()
  }, [queryParams])

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.search.trim() ||
        filters.authorId ||
        filters.pinned !== "all" ||
        filters.includeDeleted ||
        filters.dateFrom ||
        filters.dateTo
    )
  }, [filters])

  return {
    filters,
    page,
    limit,
    queryParams,
    queryString,
    hasActiveFilters,
    setSearch,
    setAuthorId,
    setPinned,
    setIncludeDeleted,
    setDateRange,
    setPage,
    setLimit,
    resetFilters,
  }
}
