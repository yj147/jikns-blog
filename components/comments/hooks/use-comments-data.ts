"use client"

import { useCallback, useMemo } from "react"
import useSWRInfinite from "swr/infinite"

import { fetchGet } from "@/lib/api/fetch-json"
import type { Comment, CommentTargetType } from "@/types/comments"

const PAGE_SIZE = 10

const EMPTY_PAGES: CommentsApiResponse[] = []

type InflightCommentsKey = string

type InflightCommentsMap = Map<InflightCommentsKey, Promise<CommentsApiResponse>>

const inflightCommentsGetRequests: InflightCommentsMap = (() => {
  const globalWithMap = globalThis as typeof globalThis & {
    __jiknsCommentsInflightGetRequests?: InflightCommentsMap
  }

  if (!globalWithMap.__jiknsCommentsInflightGetRequests) {
    globalWithMap.__jiknsCommentsInflightGetRequests = new Map<
      InflightCommentsKey,
      Promise<CommentsApiResponse>
    >()
  }

  return globalWithMap.__jiknsCommentsInflightGetRequests
})()

export type CommentsApiResponse = {
  success: boolean
  data: Comment[]
  meta?: {
    pagination?: {
      total?: number
      hasMore?: boolean
      nextCursor?: string | null
    }
  }
}

interface UseCommentsDataOptions {
  targetType: CommentTargetType
  targetId: string
  initialCount?: number
  enabled?: boolean
}

export function useCommentsData({
  targetType,
  targetId,
  initialCount = 0,
  enabled = true,
}: UseCommentsDataOptions) {
  const fetcher = useCallback(async (url: string) => {
    const existing = inflightCommentsGetRequests.get(url)
    if (existing) {
      return existing
    }

    const promise = fetchGet<CommentsApiResponse>(url).finally(() => {
      inflightCommentsGetRequests.delete(url)
    })

    inflightCommentsGetRequests.set(url, promise)
    return promise
  }, [])

  const getKey = useCallback(
    (pageIndex: number, previousPageData: CommentsApiResponse | null) => {
      if (!enabled) return null
      if (previousPageData && !previousPageData.meta?.pagination?.hasMore) {
        return null
      }

      const params = new URLSearchParams({
        targetType,
        targetId,
        limit: PAGE_SIZE.toString(),
      })

      const cursor = previousPageData?.meta?.pagination?.nextCursor
      if (cursor) {
        params.set("cursor", cursor)
      }

      return `/api/comments?${params.toString()}`
    },
    [enabled, targetType, targetId]
  )

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<CommentsApiResponse>(getKey, fetcher, {
      revalidateOnFocus: false,
      revalidateAll: false,
    })

  const pages = data ?? EMPTY_PAGES
  const comments = useMemo(() => pages.flatMap((page) => page?.data ?? []), [pages])

  const totalComments = useMemo(() => {
    const total = pages[0]?.meta?.pagination?.total

    if (typeof total === "number") {
      return total
    }

    if (comments.length > 0) {
      return comments.length
    }

    return initialCount
  }, [comments.length, pages, initialCount])

  const hasMore = useMemo(() => {
    if (pages.length === 0) return false
    return pages[pages.length - 1]?.meta?.pagination?.hasMore ?? false
  }, [pages])

  const isInitialLoading = !data && !error
  const isLoadingMore = isValidating && size > (data?.length ?? 0)
  const isEmpty = !isInitialLoading && comments.length === 0

  const resetList = useCallback(
    async (preserveSize = false) => {
      if (preserveSize) {
        await mutate()
        return
      }

      // setSize() 会触发 revalidate；避免 setSize + mutate 导致重复请求
      if (size !== 1) {
        await setSize(1)
        return
      }

      await mutate()
    },
    [mutate, setSize, size]
  )

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      setSize((current) => current + 1)
    }
  }, [hasMore, isLoadingMore, setSize])

  return {
    comments,
    totalComments,
    hasMore,
    isInitialLoading,
    isLoadingMore,
    isEmpty,
    error: error ?? null,
    mutate,
    isLoading,
    loadMore,
    resetList,
  }
}
