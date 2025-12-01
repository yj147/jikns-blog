"use client"

import useSWRInfinite from "swr/infinite"
import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Heart, AlertTriangle } from "lucide-react"
import { ActivityCard } from "@/components/activity-card"
import { BlogPostCard } from "@/components/blog/blog-post-card"
import { fetchJson } from "@/lib/api/fetch-json"
import type { ActivityCardProps } from "@/types/activity"
import type { PostListItem } from "@/types/blog"

interface ProfileLikesTabProps {
  userId: string
}

interface ActivityLikeItem {
  type: "activity"
  likedAt: string
  activity: ActivityCardProps["activity"]
}

interface PostLikeItem {
  type: "post"
  likedAt: string
  post: PostListItem
}

type LikeItem = ActivityLikeItem | PostLikeItem

interface LikesResponse {
  success: boolean
  data: LikeItem[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

const PAGE_SIZE = 10

const fetcher = (url: string) => fetchJson<LikesResponse>(url)

function formatLikedAt(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value))
  } catch {
    return value
  }
}

export function ProfileLikesTab({ userId }: ProfileLikesTabProps) {
  const getKey = (pageIndex: number, previousPageData: LikesResponse | null) => {
    if (previousPageData && !previousPageData.pagination?.hasMore) {
      return null
    }
    const page = pageIndex + 1
    return `/api/users/${userId}/likes?page=${page}&limit=${PAGE_SIZE}`
  }

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  const likes = useMemo(() => (data ? data.flatMap((page) => page.data ?? []) : []), [data])
  const lastPage = data?.[data.length - 1]
  const hasMore = lastPage?.pagination?.hasMore ?? false
  const isInitialLoading = isLoading && size === 1 && likes.length === 0
  const isLoadingMore = isValidating && size > 1

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardContent className="pt-6 space-y-4">
              <div className="bg-muted h-4 w-24 rounded" />
              <div className="bg-muted h-3 w-16 rounded" />
              <div className="bg-muted h-24 w-full rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground mb-4">加载点赞内容失败</p>
          <Button onClick={() => mutate()} variant="outline">
            重新加载
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (likes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <Heart className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <p className="text-muted-foreground">还没有点赞的内容</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {likes.map((item, index) => {
        const key = item.type === "activity" ? item.activity.id : item.post.id
        return (
          <div key={`${item.type}-${key}-${item.likedAt}`} className="space-y-2">
            {item.type === "activity" ? (
              <ActivityCard activity={item.activity} showActions={false} />
            ) : (
              <BlogPostCard post={item.post} index={index} />
            )}
            <p className="text-muted-foreground text-xs">点赞于 {formatLikedAt(item.likedAt)}</p>
          </div>
        )
      })}

      {hasMore && (
        <div className="py-4 text-center">
          <Button
            onClick={() => setSize((prev) => prev + 1)}
            disabled={isLoadingMore}
            variant="outline"
          >
            {isLoadingMore ? "加载中..." : "加载更多"}
          </Button>
        </div>
      )}
    </div>
  )
}
