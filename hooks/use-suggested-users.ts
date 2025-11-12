"use client"

import useSWR from "swr"
import { logger } from "@/lib/utils/logger"

// 推荐用户数据类型
interface SuggestedUser {
  id: string
  name: string
  username: string
  avatarUrl?: string | null
  bio: string
  role: "USER" | "ADMIN"
  followers: number
  postsCount: number
  activitiesCount: number
  isVerified: boolean
}

interface SuggestedUsersPayload {
  data: SuggestedUser[]
  meta: {
    total: number
    limit: number
    algorithm: string
  }
  message: string
}

interface SuggestedUsersResponse {
  success: boolean
  data?: SuggestedUsersPayload | SuggestedUser[]
  error?: {
    message?: string
  }
  meta?: {
    timestamp: string
    [key: string]: unknown
  }
}

// API 请求工具
const fetcher = async (url: string): Promise<SuggestedUsersResponse> => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error?.message || "获取推荐用户失败")
  }
  return res.json()
}

// 获取推荐用户的 Hook
export function useSuggestedUsers(limit: number = 5) {
  const { data, error, isLoading, mutate } = useSWR<SuggestedUsersResponse>(
    `/api/users/suggested?limit=${limit}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorRetryCount: 2,
      onError: (error) => {
        logger.error("获取推荐用户失败:", error)
        // 不在这里显示toast，让组件自行处理
      },
    }
  )

  const payload = data?.data

  const normalizedUsers = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as SuggestedUsersPayload | undefined)?.data)
      ? (payload as SuggestedUsersPayload).data
      : []

  const payloadMeta =
    payload && !Array.isArray(payload) ? (payload as SuggestedUsersPayload).meta : undefined

  return {
    suggestedUsers: normalizedUsers,
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
    meta: payloadMeta,
  }
}
