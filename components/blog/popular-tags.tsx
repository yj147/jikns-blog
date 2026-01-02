/**
 * 热门标签推荐组件
 * Phase 10 - M4 阶段
 */

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Hash, TrendingUp, Loader2, AlertCircle } from "lucide-react"
import { getPopularTags } from "@/lib/actions/tags"

interface PopularTag {
  id: string
  name: string
  slug: string
  color?: string | null
  postsCount: number
}

interface PopularTagsProps {
  limit?: number
  className?: string
  showTitle?: boolean
  layout?: "horizontal" | "grid"
}

export function PopularTags({
  limit = 8,
  className = "",
  showTitle = true,
  layout = "grid",
}: PopularTagsProps) {
  const [tags, setTags] = useState<PopularTag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const extractRetryAfter = (details: unknown): number | null => {
    if (typeof details === "object" && details !== null && "retryAfter" in details) {
      const value = Number((details as Record<string, unknown>).retryAfter)
      return Number.isFinite(value) ? value : null
    }
    return null
  }

  const loadTags = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    setRetryAfter(null)

    try {
      const result = await getPopularTags(limit)
      if (result.success && result.data?.tags) {
        if (!mountedRef.current) return
        setTags(result.data.tags)
        return
      }

      if (!mountedRef.current) return
      setTags([])
      setErrorMessage(result.error?.message || "获取热门标签失败")
      setRetryAfter(extractRetryAfter(result.error?.details))
    } catch (error) {
      if (!mountedRef.current) return
      setTags([])
      setErrorMessage(error instanceof Error ? error.message : "获取热门标签失败")
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [limit])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  const handleRetry = useCallback(() => {
    void loadTags()
  }, [loadTags])

  if (isLoading) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              热门标签
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (errorMessage) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              热门标签
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <AlertCircle className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">{errorMessage}</p>
            {typeof retryAfter === "number" && retryAfter > 0 && (
              <p className="text-muted-foreground text-xs">请等待约 {retryAfter} 秒后重试</p>
            )}
            <Button variant="outline" size="sm" onClick={handleRetry}>
              重新加载
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (tags.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            热门标签
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div
          className={
            layout === "horizontal" ? "flex gap-2 overflow-x-auto pb-2" : "flex flex-wrap gap-2"
          }
        >
          {tags.map((tag, index) => (
            <div
              key={tag.id}
              className="transition-transform duration-200 hover:scale-105 active:scale-95"
            >
              <Link href={`/tags/${tag.slug}`} prefetch={false}>
                <Badge
                  variant="outline"
                  className="hover:bg-primary hover:text-primary-foreground cursor-pointer transition-all hover:shadow-md"
                  style={
                    tag.color
                      ? {
                          borderColor: tag.color,
                          color: tag.color,
                        }
                      : {}
                  }
                >
                  <Hash className="mr-1 h-3 w-3" />
                  {tag.name}
                  <span className="ml-1 opacity-70">({tag.postsCount})</span>
                </Badge>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
