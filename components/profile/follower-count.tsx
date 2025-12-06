"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error("failed to fetch follower count")
  }
  return res.json()
}

interface FollowerCountProps {
  userId: string
  initialCount: number
}

/**
 * 粉丝数展示组件（带 SWR 实时同步）
 * - 以服务器渲染值为初始值
 * - 监听 /api/users/[id]/public 缓存，跟随 FollowButton 的 mutate 同步更新
 */
export function FollowerCount({ userId, initialCount }: FollowerCountProps) {
  const [count, setCount] = useState(initialCount)

  const { data } = useSWR(userId ? `/api/users/${userId}/public` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5_000,
  })

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    const next = data?.data?.counts?.followers
    if (typeof next === "number") {
      setCount(next)
    }
  }, [data])

  return (
    <p className="text-lg font-bold" data-testid="followers-count">
      {count}
    </p>
  )
}

export default FollowerCount
