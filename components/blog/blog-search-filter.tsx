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
import { motion } from "framer-motion"
import { useDebounce } from "@/hooks/use-debounce"
import {
  createBlogListUrl,
  sanitizeSearchQuery,
  isValidSearchQuery,
} from "@/lib/utils/blog-helpers"

interface BlogSearchFilterProps {
  className?: string
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

// 热门标签（这里可以从API获取）
const popularTags = ["技术", "设计", "AI", "开源", "架构", "UX", "Web开发", "最佳实践"]

export function BlogSearchFilter({ className = "" }: BlogSearchFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

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

      const url = createBlogListUrl({
        q: cleanQuery,
        tag: selectedTag,
        sort: sortBy,
        order: sortOrder,
        page: 1, // 搜索时重置到第一页
      })

      router.push(url)
    },
    [selectedTag, selectedSort, router]
  )

  // 处理标签筛选
  const handleTagFilter = useCallback(
    (tag: string) => {
      setSelectedTag(tag)
      const [sortBy, sortOrder] = selectedSort.split("-")

      const url = createBlogListUrl({
        q: query,
        tag: tag,
        sort: sortBy,
        order: sortOrder,
        page: 1,
      })

      router.push(url)
    },
    [query, selectedSort, router]
  )

  // 处理排序变更
  const handleSortChange = useCallback(
    (sortValue: string) => {
      setSelectedSort(sortValue)
      const [sortBy, sortOrder] = sortValue.split("-")

      const url = createBlogListUrl({
        q: query,
        tag: selectedTag,
        sort: sortBy,
        order: sortOrder,
        page: 1,
      })

      router.push(url)
    },
    [query, selectedTag, router]
  )

  // 清除所有筛选
  const handleClearFilters = useCallback(() => {
    setQuery("")
    setSelectedTag("")
    setSelectedSort("publishedAt-desc")
    router.push("/blog")
  }, [router])

  // 响应防抖查询变化
  useEffect(() => {
    handleSearch(debouncedQuery)
  }, [debouncedQuery, handleSearch])

  // 检查是否有活动的筛选条件
  const hasActiveFilters = query || selectedTag || selectedSort !== "publishedAt-desc"

  return (
    <motion.div
      className={`space-y-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* 搜索栏和基础筛选 */}
      <div className="flex flex-col gap-4 md:flex-row">
        {/* 搜索输入框 */}
        <motion.div
          className="relative flex-1"
          whileFocus={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            placeholder="搜索文章标题、内容..."
            className="pl-10 pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
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
        </motion.div>

        {/* 排序选择 */}
        <motion.div whileHover={{ scale: 1.02 }} className="w-full md:w-48">
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
        </motion.div>

        {/* 高级筛选切换 */}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="outline"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className="flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>筛选</span>
          </Button>
        </motion.div>
      </div>

      {/* 高级筛选面板 */}
      <motion.div
        initial={false}
        animate={{ height: showAdvancedFilter ? "auto" : 0, opacity: showAdvancedFilter ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="space-y-4 pt-2">
          {/* 标签筛选 */}
          <div>
            <h4 className="mb-2 text-sm font-medium">热门标签</h4>
            <div className="flex flex-wrap gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTagFilter("")}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  !selectedTag
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                全部
              </motion.button>
              {popularTags.map((tag) => (
                <motion.button
                  key={tag}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTagFilter(tag)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    selectedTag === tag
                      ? "bg-primary text-primary-foreground"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {tag}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 活动筛选条件显示和清除 */}
      {hasActiveFilters && (
        <motion.div
          className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-muted-foreground">活动筛选:</span>
            {query && (
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-xs">
                搜索: "{query}"
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

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-xs">
              清除筛选
            </Button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}
