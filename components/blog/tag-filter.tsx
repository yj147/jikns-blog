/**
 * 标签筛选组件
 * Phase 10 - M3 阶段
 */

"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Hash, X, Loader2, AlertCircle } from "lucide-react"
import { fetchJson } from "@/lib/api/fetch-json"

type TagsApiResponse = {
  success: boolean
  data?: {
    tags?: PopularTag[]
  }
  error?: {
    message?: string
    details?: unknown
  }
}

export interface PopularTag {
  id: string
  name: string
  slug: string
  color?: string | null
  postsCount: number
}

interface TagFilterProps {
  className?: string
  limit?: number
  initialTags?: PopularTag[]
  selectedTag?: string | null
  onTagChange?: (slug: string | null) => void
}

export function TagFilter({
  className = "",
  limit = 10,
  initialTags,
  selectedTag: selectedTagProp,
  onTagChange,
}: TagFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsKey = useMemo(() => searchParams.toString(), [searchParams])

  const [tags, setTags] = useState<PopularTag[]>(() => {
    if (initialTags) {
      return initialTags.slice(0, limit)
    }
    return []
  })
  const [isLoading, setIsLoading] = useState(() => initialTags === undefined)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [retryAfter, setRetryAfter] = useState<number | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(
    selectedTagProp ?? searchParams.get("tag")
  )
  const isControlled = typeof selectedTagProp !== "undefined"
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // 从 URL 参数初始化选中的标签
  useEffect(() => {
    if (isControlled) {
      setSelectedTag(selectedTagProp ?? null)
      return
    }
    const tagParam = searchParams.get("tag")
    setSelectedTag((prev) => (prev !== tagParam ? tagParam : prev))
  }, [isControlled, selectedTagProp, searchParams, searchParamsKey]) // 使用字符串作为依赖项，更稳定

  // 初始标签同步
  useEffect(() => {
    if (initialTags !== undefined) {
      setTags(initialTags.slice(0, limit))
      setIsLoading(false)
      setErrorMessage(null)
      setRetryAfter(null)
    }
  }, [initialTags, limit])

  const extractRetryAfter = (details: unknown): number | null => {
    if (typeof details === "object" && details !== null && "retryAfter" in details) {
      const value = Number((details as Record<string, unknown>).retryAfter)
      return Number.isFinite(value) ? value : null
    }
    return null
  }

  const loadTags = useCallback(async () => {
    if (initialTags !== undefined) return

    setIsLoading(true)
    setErrorMessage(null)
    setRetryAfter(null)

    try {
      const params = new URLSearchParams()
      params.set("page", "1")
      params.set("limit", String(limit))
      params.set("orderBy", "postsCount")
      params.set("order", "desc")
      const result = await fetchJson<TagsApiResponse>(`/api/tags?${params.toString()}`)
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
  }, [initialTags, limit])

  // 加载热门标签
  useEffect(() => {
    if (initialTags !== undefined) return
    void loadTags()
  }, [initialTags, loadTags])

  const handleRetry = useCallback(() => {
    void loadTags()
  }, [loadTags])

  const applySelection = (slug: string | null) => {
    if (!isControlled) {
      setSelectedTag(slug)
    }

    onTagChange?.(slug)

    if (onTagChange) {
      return
    }

    // 更新 URL
    const params = new URLSearchParams(searchParams.toString())

    if (slug) {
      params.set("tag", slug)
    } else {
      params.delete("tag")
    }

    // 重置到第一页
    params.delete("page")

    const newUrl = params.toString() ? `/blog?${params.toString()}` : "/blog"
    router.push(newUrl)
  }

  // 处理标签选择
  const handleTagClick = (slug: string) => {
    const newSelectedTag = selectedTag === slug ? null : slug
    applySelection(newSelectedTag)
  }

  // 清除所有标签筛选
  const handleClearTags = () => {
    applySelection(null)
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Hash className="h-5 w-5" />
            热门标签
          </CardTitle>
        </CardHeader>
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Hash className="h-5 w-5" />
            热门标签
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <AlertCircle className="text-muted-foreground h-8 w-8" />
            <p className="text-muted-foreground text-sm">{errorMessage}</p>
            {typeof retryAfter === "number" && retryAfter > 0 && (
              <p className="text-muted-foreground text-xs">请等待约 {retryAfter} 秒后重试</p>
            )}
            <Button variant="outline" size="sm" onClick={handleRetry}>
              重试加载
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Hash className="h-5 w-5" />
            热门标签
          </CardTitle>
          {selectedTag && (
            <Button variant="ghost" size="sm" onClick={handleClearTags} className="h-8 text-xs">
              <X className="mr-1 h-3 w-3" />
              清除
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => {
            const isSelected = selectedTag === tag.slug

            return (
              <motion.div
                key={tag.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Badge
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer transition-all hover:shadow-md"
                  style={
                    isSelected && tag.color
                      ? {
                          backgroundColor: tag.color,
                          borderColor: tag.color,
                          color: "#ffffff",
                        }
                      : {}
                  }
                  onClick={() => handleTagClick(tag.slug)}
                >
                  <Hash className="mr-1 h-3 w-3" />
                  {tag.name}
                  <span className="ml-1 opacity-70">({tag.postsCount})</span>
                </Badge>
              </motion.div>
            )
          })}
        </div>

        {/* 查看所有标签链接 */}
        <div className="mt-4 text-center">
          <Button variant="link" size="sm" asChild>
            <a href="/tags">查看所有标签 →</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
