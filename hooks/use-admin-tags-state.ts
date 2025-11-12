"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import type { ApiResponse, GetTagsOptions, TagData, TagListPagination } from "@/lib/actions/tags"
import { useDebounce } from "@/hooks/use-debounce"
import { toast } from "sonner"

interface UseAdminTagsStateOptions {
  initialTags: TagData[]
  initialPagination: TagListPagination
  getTagsAction: (
    options: Partial<GetTagsOptions>
  ) => Promise<ApiResponse<{ tags: TagData[]; pagination: TagListPagination }>>
  debounceMs?: number
}

interface UseAdminTagsStateResult {
  tags: TagData[]
  searchInput: string
  setSearchInput: (value: string) => void
  activeSearch: string
  sortValue: string
  handleSortChange: (value: string) => void
  currentPage: number
  totalPages: number
  totalItems: number
  isLoading: boolean
  handlePageChange: (page: number) => void
  refreshTags: () => Promise<void>
}

export function useAdminTagsState({
  initialTags,
  initialPagination,
  getTagsAction,
  debounceMs = 300,
}: UseAdminTagsStateOptions): UseAdminTagsStateResult {
  type SortBy = GetTagsOptions["orderBy"]
  type SortOrder = GetTagsOptions["order"]

  const [tags, setTags] = useState<TagData[]>(initialTags)
  const [currentPage, setCurrentPage] = useState(initialPagination.page)
  const [totalPages, setTotalPages] = useState(Math.max(1, initialPagination.totalPages))
  const [totalItems, setTotalItems] = useState(initialPagination.total)
  const [sortBy, setSortBy] = useState<SortBy>("postsCount")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebounce(searchInput, debounceMs)
  const [activeSearch, setActiveSearch] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const latestRequestIdRef = useRef(0)
  const itemsPerPage = initialPagination.limit

  const sortValue = useMemo(() => `${sortBy}-${sortOrder}`, [sortBy, sortOrder])
  const effectiveLoading = isLoading || isPending

  const fetchTags = useCallback(
    async (overrides: Partial<GetTagsOptions> = {}) => {
      const nextPage = overrides.page ?? currentPage
      const nextOrderBy = overrides.orderBy ?? sortBy
      const nextOrder = overrides.order ?? sortOrder
      const rawSearch = overrides.search ?? activeSearch
      const trimmedSearch = typeof rawSearch === "string" ? rawSearch.trim() : ""
      const searchParam = trimmedSearch.length > 0 ? trimmedSearch : undefined
      const requestId = ++latestRequestIdRef.current

      setIsLoading(true)
      try {
        const response = await getTagsAction({
          page: nextPage,
          limit: itemsPerPage,
          orderBy: nextOrderBy,
          order: nextOrder,
          search: searchParam,
        })

        const data = response.data

        if (!response.success || !data) {
          toast.error(response.error?.message || "加载标签失败")
          return
        }

        if (requestId !== latestRequestIdRef.current) {
          return
        }

        const pagination: TagListPagination = data.pagination ??
          initialPagination ?? {
            page: 1,
            totalPages: 1,
            total: 0,
            limit: itemsPerPage,
            hasMore: false,
          }

        startTransition(() => {
          setTags(data.tags)
          setCurrentPage(pagination.page)
          setTotalPages(Math.max(1, pagination.totalPages || 1))
          setTotalItems(pagination.total)
        })
      } catch (error) {
        if (requestId === latestRequestIdRef.current) {
          toast.error("加载标签失败")
        }
      } finally {
        if (requestId === latestRequestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [activeSearch, currentPage, getTagsAction, initialPagination, itemsPerPage, sortBy, sortOrder]
  )

  useEffect(() => {
    const trimmed = debouncedSearch.trim()
    if (trimmed === activeSearch) {
      return
    }

    setActiveSearch(trimmed)
    void fetchTags({
      page: 1,
      search: trimmed,
    })
  }, [activeSearch, debouncedSearch, fetchTags])

  const handleSortChange = useCallback(
    (value: string) => {
      const [nextSortBy, nextSortOrder] = value.split("-") as [SortBy, SortOrder]
      setSortBy(nextSortBy)
      setSortOrder(nextSortOrder)
      void fetchTags({
        page: 1,
        orderBy: nextSortBy,
        order: nextSortOrder,
      })
    },
    [fetchTags]
  )

  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > totalPages) return
      void fetchTags({ page })
    },
    [fetchTags, totalPages]
  )

  const refreshTags = useCallback(async () => {
    await fetchTags()
  }, [fetchTags])

  return {
    tags,
    searchInput,
    setSearchInput,
    activeSearch,
    sortValue,
    handleSortChange,
    currentPage,
    totalPages,
    totalItems,
    isLoading: effectiveLoading,
    handlePageChange,
    refreshTags,
  }
}
