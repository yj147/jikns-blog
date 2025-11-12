"use client"

import { useMemo } from "react"
import useSWR from "swr"
import useSWRInfinite from "swr/infinite"
import { logger } from "@/lib/utils/logger"
import { fetchPost } from "@/lib/api/fetch-json"

/**
 * 关注列表项的类型定义
 *
 * Linus 原则：数据结构驱动设计
 * 只包含公开信息，绝不暴露 PII（如 email）
 */
export interface FollowListItem {
  id: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  status: "ACTIVE" | "BANNED"
  isMutual: boolean
  followedAt: string
}

// API 响应类型
interface FollowListResponse {
  success: boolean
  data: FollowListItem[]
  meta: {
    pagination: {
      page: number
      limit: number
      total: number | null
      hasMore: boolean
      nextCursor?: string
    }
  }
}

// Hook 配置选项
interface UseFollowListOptions {
  /** 每页加载数量 */
  limit?: number
  /** 是否自动加载 */
  autoLoad?: boolean
  /** 是否请求总数（默认 false，设为 true 会执行 COUNT(*) 查询） */
  includeTotal?: boolean
  /** 自定义 fetcher */
  fetcher?: (url: string) => Promise<FollowListResponse>
  /** SWR 重新验证配置 */
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
}

// 默认 fetcher
const defaultFetcher = async (url: string): Promise<FollowListResponse> => {
  const res = await fetch(url, {
    credentials: "same-origin",
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "获取列表失败")
  }

  return res.json()
}

// 生成 SWR key 的函数
function createKeyGetter(
  listType: "followers" | "following",
  userId: string,
  limit: number,
  includeTotal: boolean
) {
  return (pageIndex: number, previousPageData: FollowListResponse | null) => {
    // 如果是第一页，或者之前的页面为空，直接返回第一页的 URL
    if (pageIndex === 0) {
      const params = new URLSearchParams({ limit: String(limit) })
      // 首次请求：根据 includeTotal 选项决定是否请求总数
      if (includeTotal) {
        params.set("includeTotal", "true")
      } else {
        params.set("includeTotal", "false")
      }
      return `/api/users/${userId}/${listType}?${params.toString()}`
    }

    // 如果前一页没有数据，返回 null 停止加载
    if (!previousPageData) return null

    // 如果前一页显示没有更多数据，停止加载
    if (!previousPageData.meta?.pagination?.hasMore) return null

    // 使用 cursor 进行分页
    const cursor = previousPageData.meta.pagination.nextCursor
    if (!cursor) return null

    const params = new URLSearchParams({ limit: String(limit), cursor })
    // 后续请求：始终跳过 COUNT(*) 以优化性能
    params.set("includeTotal", "false")
    return `/api/users/${userId}/${listType}?${params.toString()}`
  }
}

/**
 * 通用的关注列表 Hook (粉丝/关注)
 */
function useFollowList(
  listType: "followers" | "following",
  userId: string,
  options: UseFollowListOptions = {}
) {
  const {
    limit = 20,
    autoLoad = true,
    includeTotal = false,
    fetcher = defaultFetcher,
    revalidateOnFocus = false,
    revalidateOnReconnect = false,
  } = options

  const getKey = createKeyGetter(listType, userId, limit, includeTotal)

  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite(
    autoLoad ? getKey : () => null,
    fetcher,
    {
      revalidateOnFocus,
      revalidateOnReconnect,
      errorRetryCount: 2,
      onError: (error) => {
        logger.error(`获取${listType === "followers" ? "粉丝" : "关注"}列表失败:`, error)
      },
    }
  )

  // 扁平化所有页面的数据
  const items: FollowListItem[] = data ? data.flatMap((page) => page.data || []) : []

  // 获取最后一页的分页信息
  const lastPage = data?.[data.length - 1]
  const pagination = lastPage?.meta?.pagination

  // 是否还有更多数据
  const hasMore = pagination?.hasMore ?? false

  // 是否正在加载更多
  const isInitialLoading = isLoading && size <= 1
  const isLoadingMore =
    (!isInitialLoading && isLoading) ||
    (size > 0 && !!data && typeof data[size - 1] === "undefined")

  // 加载下一页
  const loadMore = () => {
    if (!hasMore || isLoadingMore) return
    setSize((size) => size + 1)
  }

  // 刷新列表（重新加载第一页）
  const refresh = () => mutate()

  // 重置列表（清空并重新加载）
  const reset = () => {
    setSize(1)
    mutate()
  }

  return {
    items,
    isLoading: isInitialLoading,
    isLoadingMore,
    isValidating,
    isError: !!error,
    error,
    hasMore,
    loadMore,
    refresh,
    reset,
    // 额外的分页信息
    pagination: {
      total: pagination?.total ?? null,
      page: size,
      limit: pagination?.limit ?? limit,
      hasMore,
    },
  }
}

/**
 * 获取用户粉丝列表的 Hook
 */
export function useFollowers(userId: string, options?: UseFollowListOptions) {
  return useFollowList("followers", userId, options)
}

/**
 * 获取用户关注列表的 Hook
 */
export function useFollowing(userId: string, options?: UseFollowListOptions) {
  return useFollowList("following", userId, options)
}

/**
 * 自定义 Hook：获取关注状态批量查询
 *
 * Linus 原则：统一使用 fetchPost 封装，自动注入 CSRF Token
 */
export function useFollowStatusBatch(targetIds: string[], actorId?: string) {
  const uniqueTargetIds = Array.from(new Set(targetIds.filter(Boolean)))
  const shouldFetch = uniqueTargetIds.length > 0 && !!actorId
  const cacheKey = shouldFetch
    ? ["follow-status", actorId, uniqueTargetIds.slice().sort().join("|")]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      // 使用 fetchPost 自动注入 CSRF Token 和 credentials
      const response = await fetchPost<{
        success: boolean
        data: Record<string, { isFollowing: boolean; isMutual: boolean }>
      }>("/api/users/follow/status", { targetIds: uniqueTargetIds })

      // Linus 原则：API 响应格式统一
      // 返回键值对结构：{ [userId]: { isFollowing, isMutual } }
      return response.data ?? {}
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorRetryCount: 1,
      keepPreviousData: true,
    }
  )

  // Linus 原则：消除不必要的数据转换
  // API 已经返回键值对，直接使用 Map 包装即可
  const statusMap = useMemo(() => {
    const map = new Map<string, { isFollowing: boolean; isMutual: boolean }>()

    if (data) {
      Object.entries(data).forEach(([userId, status]) => {
        map.set(userId, status)
      })
    }

    return map
  }, [data])

  return {
    statusMap,
    isLoading: shouldFetch ? isLoading : false,
    isError: !!error,
    error,
    refresh: mutate,
    // 便捷方法
    isFollowing: (userId: string) => statusMap.get(userId)?.isFollowing ?? false,
    isMutual: (userId: string) => statusMap.get(userId)?.isMutual ?? false,
  }
}
