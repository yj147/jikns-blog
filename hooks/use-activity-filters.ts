import { useCallback, useEffect, useMemo, useReducer, useState } from "react"

import { ActivityFilters, ActivityOrderBy } from "@/types/activity"

const MIN_SEARCH_LENGTH = 2

type FilterAction =
  | { type: "replace"; payload: ActivityFilters }
  | { type: "merge"; payload: Partial<ActivityFilters> }
  | { type: "patchDate"; payload: { boundary: "start" | "end"; value?: Date } }

export const buildFiltersState = (
  orderBy: ActivityOrderBy,
  authorId?: string
): ActivityFilters => ({
  orderBy,
  authorId,
  hasImages: undefined,
  isPinned: undefined,
  searchTerm: undefined,
  tags: undefined,
  dateRange: undefined,
})

function filterReducer(state: ActivityFilters, action: FilterAction): ActivityFilters {
  switch (action.type) {
    case "replace":
      return action.payload
    case "merge":
      return { ...state, ...action.payload }
    case "patchDate": {
      const currentRange = state.dateRange ?? {}
      const nextStart =
        action.payload.boundary === "start" ? action.payload.value : currentRange.start
      const nextEnd = action.payload.boundary === "end" ? action.payload.value : currentRange.end

      if (!nextStart && !nextEnd) {
        return { ...state, dateRange: undefined }
      }

      return {
        ...state,
        dateRange: {
          start: nextStart,
          end: nextEnd,
        },
      }
    }
    default:
      return state
  }
}

export interface UseActivityFiltersOptions {
  orderBy: ActivityOrderBy
  userId?: string
}

export interface ApplySearchResult {
  success: boolean
  reason?: "too-short"
}

export interface UseActivityFiltersResult {
  filters: ActivityFilters
  searchDraft: string
  setSearchDraft: (value: string) => void
  tagDraft: string
  setTagDraft: (value: string) => void
  dateFromDraft: string
  setDateFromDraft: (value: string) => void
  dateToDraft: string
  setDateToDraft: (value: string) => void
  showFiltersDialog: boolean
  setShowFiltersDialog: (value: boolean) => void
  hasActiveFilters: boolean
  applySearch: () => ApplySearchResult
  clearSearch: () => void
  applyTags: () => void
  clearTagsAndDates: () => void
  clearAllFilters: () => void
  handleDateChange: (type: "start" | "end", value: string) => void
  mergeFilters: (payload: Partial<ActivityFilters>) => void
  updateOrder: (order: ActivityOrderBy) => void
}

const normalizeTags = (input: string) => {
  const cleaned = input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
  return Array.from(new Set(cleaned))
}

export function useActivityFilters({
  orderBy,
  userId,
}: UseActivityFiltersOptions): UseActivityFiltersResult {
  const [filters, dispatchFilters] = useReducer(filterReducer, buildFiltersState(orderBy, userId))

  const [searchDraft, setSearchDraft] = useState("")
  const [tagDraft, setTagDraft] = useState("")
  const [dateFromDraft, setDateFromDraft] = useState("")
  const [dateToDraft, setDateToDraft] = useState("")
  const [showFiltersDialog, setShowFiltersDialog] = useState(false)

  useEffect(() => {
    dispatchFilters({ type: "replace", payload: buildFiltersState(orderBy, userId) })
  }, [orderBy, userId])

  useEffect(() => {
    setSearchDraft(filters.searchTerm ?? "")
  }, [filters.searchTerm])

  useEffect(() => {
    setTagDraft(filters.tags && filters.tags.length > 0 ? filters.tags.join(",") : "")
    setDateFromDraft(
      filters.dateRange?.start ? filters.dateRange.start.toISOString().slice(0, 10) : ""
    )
    setDateToDraft(filters.dateRange?.end ? filters.dateRange.end.toISOString().slice(0, 10) : "")
  }, [filters.tags, filters.dateRange?.start, filters.dateRange?.end])

  const mergeFilters = useCallback((payload: Partial<ActivityFilters>) => {
    dispatchFilters({ type: "merge", payload })
  }, [])

  const updateOrder = useCallback(
    (nextOrder: ActivityOrderBy) => {
      mergeFilters({ orderBy: nextOrder })
    },
    [mergeFilters]
  )

  const applySearch = useCallback((): ApplySearchResult => {
    const trimmed = searchDraft.trim()

    if (!trimmed) {
      mergeFilters({ searchTerm: undefined })
      return { success: true }
    }

    if (trimmed.length < MIN_SEARCH_LENGTH) {
      return { success: false, reason: "too-short" }
    }

    mergeFilters({ searchTerm: trimmed })
    return { success: true }
  }, [mergeFilters, searchDraft])

  const clearSearch = useCallback(() => {
    setSearchDraft("")
    mergeFilters({ searchTerm: undefined })
  }, [mergeFilters])

  const applyTags = useCallback(() => {
    const normalized = normalizeTags(tagDraft)
    mergeFilters({ tags: normalized.length > 0 ? normalized : undefined })
  }, [mergeFilters, tagDraft])

  const clearTagsAndDates = useCallback(() => {
    setTagDraft("")
    setDateFromDraft("")
    setDateToDraft("")
    mergeFilters({ tags: undefined, dateRange: undefined })
  }, [mergeFilters])

  const clearAllFilters = useCallback(() => {
    const next = buildFiltersState(orderBy, userId)
    dispatchFilters({ type: "replace", payload: next })
    setSearchDraft("")
    setTagDraft("")
    setDateFromDraft("")
    setDateToDraft("")
  }, [orderBy, userId])

  const handleDateChange = useCallback((type: "start" | "end", value: string) => {
    const nextDate = value ? new Date(`${value}T00:00:00.000Z`) : undefined

    if (nextDate) {
      if (type === "start") {
        nextDate.setUTCHours(0, 0, 0, 0)
      } else {
        nextDate.setUTCHours(23, 59, 59, 999)
      }
    }

    dispatchFilters({ type: "patchDate", payload: { boundary: type, value: nextDate } })
  }, [])

  const hasActiveFilters = useMemo(() => {
    return (
      (filters.searchTerm ?? "").length > 0 ||
      typeof filters.hasImages === "boolean" ||
      typeof filters.isPinned === "boolean" ||
      (filters.tags && filters.tags.length > 0) ||
      !!filters.dateRange?.start ||
      !!filters.dateRange?.end
    )
  }, [filters])

  return {
    filters,
    searchDraft,
    setSearchDraft,
    tagDraft,
    setTagDraft,
    dateFromDraft,
    setDateFromDraft,
    dateToDraft,
    setDateToDraft,
    showFiltersDialog,
    setShowFiltersDialog,
    hasActiveFilters,
    applySearch,
    clearSearch,
    applyTags,
    clearTagsAndDates,
    clearAllFilters,
    handleDateChange,
    mergeFilters,
    updateOrder,
  }
}

export { MIN_SEARCH_LENGTH }
