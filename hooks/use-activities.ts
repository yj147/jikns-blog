"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import useSWRInfinite, { SWRInfiniteKeyLoader } from "swr/infinite"
import { toast } from "sonner"
import {
  ActivityWithAuthor,
  ActivityCreateData,
  ActivityUpdateData,
  ActivityQueryParams,
  ActivityApiResponse,
  UseActivitiesState,
  UseActivityMutationsState,
} from "@/types/activity"
import { ensureCsrfToken, getCsrfHeaders } from "@/lib/security/csrf-client"

// 类型守卫：将 unknown 错误转换为 Error 对象
function toError(err: unknown): Error {
  if (err instanceof Error) return err
  return new Error(String(err))
}

// API 请求工具
const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "请求失败")
  }
  return res.json()
}

// 获取动态列表的 Hook（支持无限滚动）
declare global {
  interface Window {
    __activityFixture?: string
    __activityRequestLog?: string[]
  }
}

interface UseActivitiesOptions {
  initialPages?: ActivityApiResponse<ActivityWithAuthor[]>[]
}

export function useActivities(
  params?: Partial<ActivityQueryParams>,
  options: UseActivitiesOptions = {}
): UseActivitiesState {
  const getKey: SWRInfiniteKeyLoader<ActivityApiResponse<ActivityWithAuthor[]>> = (
    pageIndex,
    previousPageData
  ) => {
    // 到达最后一页
    if (previousPageData && !previousPageData.meta?.pagination?.hasMore) {
      return null
    }

    // 构建查询参数：直接设置，避免类型断言
    const queryParams = new URLSearchParams()

    // 简单字符串参数
    if (params?.orderBy) queryParams.set("orderBy", params.orderBy)
    if (params?.authorId) queryParams.set("authorId", params.authorId)

    // 数值参数
    if (params?.limit) {
      queryParams.set("limit", params.limit.toString())
    }

    // 测试 fixture（仅浏览器环境）
    if (typeof window !== "undefined" && window.__activityFixture) {
      queryParams.set("__fixture", window.__activityFixture)
    }

    // 布尔参数
    const booleanParams: Array<[string, boolean | null | undefined]> = [
      ["hasImages", params?.hasImages],
      ["isPinned", params?.isPinned],
    ]

    booleanParams.forEach(([key, value]) => {
      if (typeof value === "boolean") {
        queryParams.set(key, value ? "true" : "false")
      }
    })

    // 搜索关键词（需要 trim）
    if (typeof params?.q === "string" && params.q.trim().length > 0) {
      queryParams.set("q", params.q.trim())
    }

    // 日期参数
    const dateParams: Array<[string, Date | null | undefined]> = [
      ["dateFrom", params?.dateFrom],
      ["dateTo", params?.dateTo],
    ]

    dateParams.forEach(([key, value]) => {
      if (value instanceof Date) {
        queryParams.set(key, value.toISOString())
      }
    })

    // 数组参数
    if (Array.isArray(params?.tags) && params.tags.length > 0) {
      queryParams.set("tags", params.tags.join(","))
    }

    // 游标分页
    const cursor = previousPageData?.meta?.pagination?.nextCursor
    if (cursor) {
      queryParams.set("cursor", cursor)
    } else {
      // 偏移分页
      queryParams.set("page", (pageIndex + 1).toString())
    }

    return `/api/activities?${queryParams.toString()}`
  }

  const { data, error, isLoading, size, setSize, mutate } = useSWRInfinite<
    ActivityApiResponse<ActivityWithAuthor[]>
  >(getKey, fetcher, {
    revalidateFirstPage: false,
    revalidateAll: false,
    parallel: false,
    fallbackData: options.initialPages,
    revalidateOnMount: !options.initialPages,
  })

  // 处理数据
  const activities = data ? data.flatMap((page) => page.data || []) : []
  const firstPageMeta = data?.[0]?.meta?.pagination
  const total = typeof firstPageMeta?.total === "number" ? firstPageMeta.total : null
  const appliedFilters = data?.[0]?.meta?.filters ?? null
  const hasMore = data ? (data[data.length - 1]?.meta?.pagination?.hasMore ?? false) : false

  const loadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      setSize(size + 1)
    }
  }, [isLoading, hasMore, size, setSize])

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    activities,
    isLoading,
    isError: !!error,
    error,
    hasMore,
    total,
    appliedFilters,
    loadMore,
    refresh,
    mutate,
  }
}

// 获取单个动态的 Hook
export function useActivity(id: string) {
  const { data, error, isLoading, mutate } = useSWR<ActivityApiResponse<ActivityWithAuthor>>(
    id ? `/api/activities/${id}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  )

  return {
    activity: data?.data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

// 动态操作的 Hook (创建、更新、删除、点赞等)
export function useActivityMutations(): UseActivityMutationsState {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // 创建动态
  const createActivity = useCallback(
    async (data: ActivityCreateData): Promise<ActivityWithAuthor> => {
      setIsLoading(true)
      setError(null)

      try {
        const csrf = await ensureCsrfToken()
        const response = await fetch("/api/activities", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(csrf),
          },
          credentials: "include",
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || "创建失败")
        }

        const result = await response.json()

        // 刷新列表缓存
        globalMutate(
          (key) => typeof key === "string" && key.startsWith("/api/activities"),
          undefined,
          { revalidate: true }
        )

        toast.success("动态发布成功")
        return result.data
      } catch (err) {
        const error = toError(err)
        setError(error)
        toast.error(error.message)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 更新动态
  const updateActivity = useCallback(
    async (id: string, data: ActivityUpdateData): Promise<ActivityWithAuthor> => {
      setIsLoading(true)
      setError(null)

      try {
        const csrf = await ensureCsrfToken()
        const response = await fetch(`/api/activities/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getCsrfHeaders(csrf),
          },
          credentials: "include",
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || "更新失败")
        }

        const result = await response.json()

        // 刷新单个动态和列表缓存
        globalMutate(`/api/activities/${id}`)
        globalMutate(
          (key) => typeof key === "string" && key.startsWith("/api/activities"),
          undefined,
          { revalidate: true }
        )

        toast.success("动态更新成功")
        return result.data
      } catch (err) {
        const error = toError(err)
        setError(error)
        toast.error(error.message)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  // 删除动态
  const deleteActivity = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true)
    setError(null)

    try {
      const csrf = await ensureCsrfToken()
      const response = await fetch(`/api/activities/${id}`, {
        method: "DELETE",
        headers: {
          ...getCsrfHeaders(csrf),
        },
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "删除失败")
      }

      // 刷新列表缓存
      globalMutate(
        (key) => typeof key === "string" && key.startsWith("/api/activities"),
        undefined,
        { revalidate: true }
      )

      toast.success("动态已删除")
    } catch (err) {
      const error = toError(err)
      setError(error)
      toast.error(error.message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    createActivity,
    updateActivity,
    deleteActivity,
    isLoading,
    error,
  }
}

// 图片上传 Hook
export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({})

  const uploadImages = useCallback(async (files: File[]): Promise<string[]> => {
    setIsUploading(true)
    setUploadProgress({})

    try {
      const formData = new FormData()
      files.forEach((file, index) => {
        formData.append("files", file)
        setUploadProgress((prev) => ({ ...prev, [index]: 0 }))
      })

      const csrf = await ensureCsrfToken()
      const response = await fetch("/api/upload/images", {
        method: "POST",
        headers: {
          ...getCsrfHeaders(csrf),
        },
        credentials: "include",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || "上传失败")
      }

      const result = await response.json()
      const payload = result.data ?? result

      if (!payload?.urls) {
        throw new Error("上传响应格式无效")
      }

      if (payload.failed && payload.failed.length > 0) {
        const failedList = payload.failed
          .map((item: { fileName?: string; error?: string }) =>
            [item.fileName, item.error].filter(Boolean).join(": ")
          )
          .join("；")

        toast(`部分图片上传失败`, {
          description: failedList,
        })
      }

      return payload.urls
    } catch (err) {
      const error = toError(err)
      toast.error(`图片上传失败: ${error.message}`)
      throw error
    } finally {
      setIsUploading(false)
      setUploadProgress({})
    }
  }, [])

  return {
    uploadImages,
    isUploading,
    uploadProgress,
  }
}
