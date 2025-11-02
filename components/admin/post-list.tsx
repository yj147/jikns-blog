"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostCard, type Post } from "./post-card"
import { Search, Filter, LayoutGrid, LayoutList, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

export interface PostListProps {
  posts: Post[]
  onEdit?: (post: Post) => void
  onDelete?: (post: Post) => Promise<void>
  onTogglePin?: (post: Post) => Promise<void>
  onTogglePublish?: (post: Post) => Promise<void>
  onCreateNew?: () => void
  isLoading?: boolean
  className?: string
}

type SortOption = "newest" | "oldest" | "title" | "views" | "likes"
type FilterStatus = "all" | "published" | "draft" | "pinned"
type ViewMode = "grid" | "list" | "compact"

export function PostList({
  posts,
  onEdit,
  onDelete,
  onTogglePin,
  onTogglePublish,
  onCreateNew,
  isLoading = false,
  className,
}: PostListProps) {
  // 搜索和筛选状态
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  // 获取所有标签
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    posts.forEach((post) => {
      post.tags.forEach((tag) => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [posts])

  // 过滤和排序文章
  const filteredAndSortedPosts = useMemo(() => {
    let filtered = posts

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          (post.summary && post.summary.toLowerCase().includes(query)) ||
          post.tags.some((tag) => tag.toLowerCase().includes(query))
      )
    }

    // 标签过滤
    if (selectedTags.length > 0) {
      filtered = filtered.filter((post) => selectedTags.every((tag) => post.tags.includes(tag)))
    }

    // 状态过滤
    switch (filterStatus) {
      case "published":
        filtered = filtered.filter((post) => post.isPublished)
        break
      case "draft":
        filtered = filtered.filter((post) => !post.isPublished)
        break
      case "pinned":
        filtered = filtered.filter((post) => post.isPinned)
        break
    }

    // 排序
    switch (sortBy) {
      case "newest":
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case "oldest":
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case "title":
        filtered.sort((a, b) => a.title.localeCompare(b.title))
        break
      case "views":
        filtered.sort((a, b) => (b.views || 0) - (a.views || 0))
        break
      case "likes":
        filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0))
        break
    }

    return filtered
  }, [posts, searchQuery, selectedTags, filterStatus, sortBy])

  // 分页计算
  const totalPages = Math.ceil(filteredAndSortedPosts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentPosts = filteredAndSortedPosts.slice(startIndex, endIndex)

  // 重置分页当过滤条件变化时
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // 标签切换
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
    handleFilterChange()
  }

  // 清除所有过滤器
  const clearFilters = () => {
    setSearchQuery("")
    setSelectedTags([])
    setFilterStatus("all")
    setCurrentPage(1)
  }

  // 统计数据
  const stats = useMemo(() => {
    const published = posts.filter((p) => p.isPublished).length
    const drafts = posts.filter((p) => !p.isPublished).length
    const pinned = posts.filter((p) => p.isPinned).length
    return { total: posts.length, published, drafts, pinned }
  }, [posts])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="bg-muted h-10 w-64 animate-pulse rounded" />
          <div className="bg-muted h-10 w-32 animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted h-64 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* 顶部工具栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">文章管理</h2>
          <Badge variant="outline">{stats.total} 篇</Badge>
        </div>

        {onCreateNew && (
          <Button onClick={onCreateNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            新建文章
          </Button>
        )}
      </div>

      {/* 统计标签 */}
      <Tabs
        value={filterStatus}
        onValueChange={(value: string) => {
          setFilterStatus(value as FilterStatus)
          handleFilterChange()
        }}
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            全部{" "}
            <Badge variant="secondary" className="ml-1">
              {stats.total}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="published">
            已发布{" "}
            <Badge variant="secondary" className="ml-1">
              {stats.published}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="draft">
            草稿{" "}
            <Badge variant="secondary" className="ml-1">
              {stats.drafts}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pinned">
            置顶{" "}
            <Badge variant="secondary" className="ml-1">
              {stats.pinned}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 搜索和筛选 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="搜索文章标题、摘要或标签..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleFilterChange()
              }}
              className="pl-10"
            />
          </div>

          {selectedTags.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              清除筛选
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 排序选择器 */}
          <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">最新</SelectItem>
              <SelectItem value="oldest">最旧</SelectItem>
              <SelectItem value="title">标题</SelectItem>
              <SelectItem value="views">浏览量</SelectItem>
              <SelectItem value="likes">点赞数</SelectItem>
            </SelectContent>
          </Select>

          {/* 每页显示数量 */}
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => setItemsPerPage(Number(value))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6</SelectItem>
              <SelectItem value="12">12</SelectItem>
              <SelectItem value="24">24</SelectItem>
              <SelectItem value="48">48</SelectItem>
            </SelectContent>
          </Select>

          {/* 视图模式切换 */}
          <div className="flex items-center rounded-lg border p-1">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 标签筛选 */}
      {allTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Filter className="text-muted-foreground h-4 w-4" />
            <span className="text-sm font-medium">按标签筛选:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {allTags.slice(0, 20).map((tag) => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                className="hover:bg-primary hover:text-primary-foreground cursor-pointer"
                onClick={() => toggleTag(tag)}
              >
                #{tag}
                {selectedTags.includes(tag) && <span className="ml-1 text-xs">×</span>}
              </Badge>
            ))}
            {allTags.length > 20 && <Badge variant="secondary">+{allTags.length - 20} 更多</Badge>}
          </div>
        </div>
      )}

      {/* 文章列表 */}
      <div className="space-y-4">
        {currentPosts.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-muted-foreground mb-4">
              {filteredAndSortedPosts.length === 0 ? "没有找到匹配的文章" : "当前页面没有文章"}
            </div>
            {filteredAndSortedPosts.length === 0 && (searchQuery || selectedTags.length > 0) && (
              <Button variant="outline" onClick={clearFilters}>
                清除筛选条件
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* 网格视图 */}
            {viewMode === "grid" && (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {currentPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                    onTogglePublish={onTogglePublish}
                    variant="admin"
                  />
                ))}
              </div>
            )}

            {/* 列表视图 */}
            {viewMode === "list" && (
              <div className="space-y-4">
                {currentPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                    onTogglePublish={onTogglePublish}
                    variant="compact"
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            显示 {startIndex + 1}-{Math.min(endIndex, filteredAndSortedPosts.length)} 条， 共{" "}
            {filteredAndSortedPosts.length} 条记录
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className={cn(
                    "cursor-pointer",
                    currentPage === 1 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // 显示当前页面周围的页码
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                })
                .map((page, index, array) => {
                  // 添加省略号
                  const showEllipsis = index > 0 && array[index - 1] !== page - 1

                  return (
                    <div key={page} className="flex items-center">
                      {showEllipsis && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      <PaginationItem>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  )
                })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className={cn(
                    "cursor-pointer",
                    currentPage === totalPages && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
