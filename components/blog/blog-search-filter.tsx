/**
 * 博客搜索筛选组件 - Phase 5.2
 * 提供搜索、筛选和排序功能
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Filter, X, SortAsc, SortDesc } from "lucide-react"
import { useDebounce } from "@/hooks/use-debounce"
import { TagFilter, type PopularTag } from "@/components/blog/tag-filter"
import {
  createBlogListUrl,
  sanitizeSearchQuery,
  isValidSearchQuery,
} from "@/lib/utils/blog-helpers"

interface BlogSearchFilterProps {
  className?: string
  popularTags?: PopularTag[]
}

// 排序选项
const sortOptions = [
  { value: "publishedAt", label: "最新发布", order: "desc" },
  { value: "publishedAt", label: "最早发布", order: "asc" },
  { value: "viewCount", label: "浏览最多", order: "desc" },
  { value: "viewCount", label: "浏览最少", order: "asc" },
  { value: "title", label: "标题 A-Z", order: "asc" },
  { value: "title", label: "标题 Z-A", order: "desc" },
]

export function BlogSearchFilter({ className = "", popularTags }: BlogSearchFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramsKey = searchParams.toString()

  const pushIfChanged = useCallback(
    (url: string) => {
      const currentUrl = `${window.location.pathname}${window.location.search}`
      if (currentUrl === url) return
      router.push(url)
    },
    [router]
  )

  // 状态管理
  const [query, setQuery] = useState(searchParams.get("q") || "")
  const [selectedTag, setSelectedTag] = useState(searchParams.get("tag") || "")
  const [selectedSort, setSelectedSort] = useState(() => {
    const sort = searchParams.get("sort") || "publishedAt"
    const order = searchParams.get("order") || "desc"
    return `${sort}-${order}`
  })
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false)

  // 防抖处理搜索
  const debouncedQuery = useDebounce(query, 500)

  // 处理搜索
  const handleSearch = useCallback(
    (searchQuery: string) => {
      if (!isValidSearchQuery(searchQuery) && searchQuery.trim() !== "") {
        return
      }

      const cleanQuery = sanitizeSearchQuery(searchQuery)
      const [sortBy, sortOrder] = selectedSort.split("-")
      const normalizedTag = selectedTag.trim()
      const isDefault =
        cleanQuery === "" && normalizedTag === "" && selectedSort === "publishedAt-desc"

      const url = isDefault
        ? "/blog"
        : createBlogListUrl({
            q: cleanQuery || undefined,
            tag: normalizedTag || undefined,
            sort: sortBy,
            order: sortOrder,
            page: 1, // 搜索时重置到第一页
          })

      pushIfChanged(url)
    },
    [selectedTag, selectedSort, pushIfChanged]
  )

  // 处理标签筛选
  const handleTagFilter = useCallback(
    (tag: string | null) => {
      const normalizedTag = tag ?? ""
      setSelectedTag(normalizedTag)
      const [sortBy, sortOrder] = selectedSort.split("-")
      const cleanQuery = sanitizeSearchQuery(query)
      const isDefault =
        cleanQuery === "" && normalizedTag.trim() === "" && selectedSort === "publishedAt-desc"

      const url = isDefault
        ? "/blog"
        : createBlogListUrl({
            q: cleanQuery || undefined,
            tag: normalizedTag.trim() || undefined,
            sort: sortBy,
            order: sortOrder,
            page: 1,
          })

      pushIfChanged(url)
    },
    [query, selectedSort, pushIfChanged]
  )

  // 处理排序变更
  const handleSortChange = useCallback(
    (sortValue: string) => {
      setSelectedSort(sortValue)
      const [sortBy, sortOrder] = sortValue.split("-")
      const cleanQuery = sanitizeSearchQuery(query)
      const normalizedTag = selectedTag.trim()
      const isDefault =
        cleanQuery === "" && normalizedTag === "" && sortValue === "publishedAt-desc"

      const url = isDefault
        ? "/blog"
        : createBlogListUrl({
            q: cleanQuery || undefined,
            tag: normalizedTag || undefined,
            sort: sortBy,
            order: sortOrder,
            page: 1,
          })

      pushIfChanged(url)
    },
    [query, selectedTag, pushIfChanged]
  )

  // 清除所有筛选
  const handleClearFilters = useCallback(() => {
    setQuery("")
    setSelectedTag("")
    setSelectedSort("publishedAt-desc")
    pushIfChanged("/blog")
  }, [pushIfChanged])

  // URL 标签变化时同步状态，兼容侧边栏筛选
  useEffect(() => {
    const tagParam = searchParams.get("tag") || ""
    setSelectedTag(tagParam)
  }, [paramsKey, searchParams])

  // 响应防抖查询变化
  useEffect(() => {
    handleSearch(debouncedQuery)
  }, [debouncedQuery, handleSearch])

  // 检查是否有活动的筛选条件
  const hasActiveFilters = query || selectedTag || selectedSort !== "publishedAt-desc"

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 搜索栏和基础筛选 */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* 搜索输入框 */}
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            id="blog-search-query"
            name="q"
            type="search"
            placeholder="搜索文章标题、内容..."
            className="pl-10 pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            aria-label="搜索文章"
          />
          {query && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 p-0"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 排序选择 */}
        <div className="w-full md:w-48">
          <Select value={selectedSort} onValueChange={handleSortChange}>
            <SelectTrigger>
              <div className="flex items-center space-x-2">
                {selectedSort.includes("asc") ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
                <SelectValue placeholder="排序方式" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem
                  key={`${option.value}-${option.order}`}
                  value={`${option.value}-${option.order}`}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 高级筛选切换 */}
        <Button
          variant="outline"
          onClick={() => setShowAdvancedFilter((current) => !current)}
          className="flex items-center space-x-2"
        >
          <Filter className="h-4 w-4" />
          <span>筛选</span>
        </Button>
      </div>

      {/* 高级筛选面板 */}
      {showAdvancedFilter ? (
        <div className="space-y-4 pt-2">
          <TagFilter
            className="bg-background border border-dashed shadow-none"
            limit={popularTags?.length ?? 10}
            initialTags={popularTags}
            selectedTag={selectedTag || null}
            onTagChange={handleTagFilter}
          />
        </div>
      ) : null}

      {/* 活动筛选条件显示和清除 */}
      {hasActiveFilters && (
        <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-muted-foreground">活动筛选:</span>
            {query && (
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-xs">
                搜索:&nbsp;&quot;
                {query}
                &quot;
              </span>
            )}
            {selectedTag && (
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-xs">
                标签: {selectedTag}
              </span>
            )}
            {selectedSort !== "publishedAt-desc" && (
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-xs">
                排序:{" "}
                {sortOptions.find((opt) => `${opt.value}-${opt.order}` === selectedSort)?.label}
              </span>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs">
            清除筛选
          </Button>
        </div>
      )}
    </div>
  )
}
