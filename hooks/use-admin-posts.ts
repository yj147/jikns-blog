"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { deletePost, publishPost, togglePinPost, unpublishPost } from "@/lib/actions/posts"
import { type Post } from "@/components/admin/post-card"
type FilterStatus = "all" | "published" | "draft" | "pinned"
type SortOption = "newest" | "oldest" | "title" | "views" | "likes"
type ViewMode = "grid" | "list" | "compact"

interface PostListStats {
  total: number
  published: number
  drafts: number
  pinned: number
}

interface PaginationState {
  currentPage: number
  totalPages: number
  totalItems: number
}

interface ApiPostItem {
  id: string
  slug: string
  title: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  coverImage: string | null
  viewCount: number
  createdAt: string
  publishedAt: string | null
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  tags: Array<{
    name: string
  }>
  stats: {
    commentsCount: number
    likesCount: number
    bookmarksCount: number
  }
}

interface AdminPostsApiResponse {
  items: ApiPostItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  stats: PostListStats
  availableTags: string[]
}

const DEFAULT_STATS: PostListStats = { total: 0, published: 0, drafts: 0, pinned: 0 }

const ERROR_MESSAGE_MAP: Record<string, string> = {
  FORBIDDEN: "没有权限执行该操作",
  NOT_FOUND: "目标文章不存在或已被删除",
  CONFLICT: "请求与现有数据冲突，请刷新后重试",
  INTERNAL_ERROR: "服务器处理失败，请稍后再试",
}

function resolveErrorMessage(code?: string, fallback?: string) {
  if (!code) return fallback || "操作失败"
  return ERROR_MESSAGE_MAP[code] || fallback || "操作失败"
}

function mapApiPostToCard(post: ApiPostItem): Post {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.excerpt || undefined,
    content: "",
    coverImage: post.coverImage || undefined,
    tags: post.tags.map((tag) => tag.name),
    isPublished: post.published,
    isPinned: post.isPinned,
    createdAt: new Date(post.createdAt),
    updatedAt: new Date(post.publishedAt ?? post.createdAt),
    views: post.viewCount,
    likes: post.stats.likesCount,
    comments: post.stats.commentsCount,
    author: {
      id: post.author.id,
      name: post.author.name || "管理员",
      avatar: post.author.avatarUrl || undefined,
    },
  }
}

export function useAdminPosts() {
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState<PostListStats>(DEFAULT_STATS)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
  })

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isFirstLoad = useRef(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery((current) => (current !== searchInput ? searchInput : current))
      setPage(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchPosts = useCallback(async () => {
    try {
      setError(null)
      if (isFirstLoad.current) {
        setIsLoading(true)
      } else {
        setIsFetching(true)
      }

      const params = new URLSearchParams()
      params.set("page", page.toString())
      params.set("limit", pageSize.toString())
      if (searchQuery) params.set("search", searchQuery)
      if (filterStatus !== "all") params.set("status", filterStatus)
      if (sortBy !== "newest") params.set("sort", sortBy)
      selectedTags.forEach((tag) => params.append("tag", tag))

      const response = await fetch(`/api/admin/posts?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`)
      }

      const payload = (await response.json()) as {
        success: boolean
        data?: AdminPostsApiResponse
        error?: { message?: string }
      }

      if (!payload.success || !payload.data) {
        throw new Error(payload.error?.message || "获取文章列表失败")
      }

      const mappedPosts = payload.data.items.map(mapApiPostToCard)
      setPosts(mappedPosts)
      setStats(payload.data.stats ?? DEFAULT_STATS)
      setAvailableTags(payload.data.availableTags ?? [])
      setPagination({
        currentPage: payload.data.pagination.page,
        totalPages: payload.data.pagination.totalPages,
        totalItems: payload.data.pagination.total,
      })
      setPage(payload.data.pagination.page)
      setPageSize(payload.data.pagination.limit)
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
      setError(message)
      toast.error(`获取文章列表失败: ${message}`)
    } finally {
      isFirstLoad.current = false
      setIsLoading(false)
      setIsFetching(false)
    }
  }, [filterStatus, page, pageSize, searchQuery, selectedTags, sortBy])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleDelete = useCallback(
    async (post: Post) => {
      try {
        const result = await deletePost(post.id)
        if (result.success) {
          toast.success("文章删除成功")
          await fetchPosts()
        } else {
          const friendly = resolveErrorMessage(result.error?.code, result.error?.message)
          setError(friendly)
          toast.error(`删除文章失败: ${friendly}`)
        }
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
        setError(message)
        toast.error("删除文章失败")
      }
    },
    [fetchPosts]
  )

  const handleTogglePin = useCallback(
    async (post: Post) => {
      try {
        const result = await togglePinPost(post.id)
        if (result.success) {
          toast.success(result.data?.message || "操作成功")
          await fetchPosts()
        } else {
          const friendly = resolveErrorMessage(result.error?.code, result.error?.message)
          setError(friendly)
          toast.error(`切换置顶状态失败: ${friendly}`)
        }
      } catch (toggleError) {
        const message = toggleError instanceof Error ? toggleError.message : String(toggleError)
        setError(message)
        toast.error("切换置顶状态失败")
      }
    },
    [fetchPosts]
  )

  const handleTogglePublish = useCallback(
    async (post: Post) => {
      try {
        const result = post.isPublished ? await unpublishPost(post.id) : await publishPost(post.id)
        if (result.success) {
          toast.success(result.data?.message || "操作成功")
          await fetchPosts()
        } else {
          const friendly = resolveErrorMessage(result.error?.code, result.error?.message)
          setError(friendly)
          toast.error(`切换发布状态失败: ${friendly}`)
        }
      } catch (toggleError) {
        const message = toggleError instanceof Error ? toggleError.message : String(toggleError)
        setError(message)
        toast.error("切换发布状态失败")
      }
    },
    [fetchPosts]
  )

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const exists = prev.includes(tag)
      const next = exists ? prev.filter((item) => item !== tag) : [...prev, tag]
      return next
    })
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setSearchInput("")
    setSearchQuery("")
    setSelectedTags([])
    setFilterStatus("all")
    setSortBy("newest")
    setPage(1)
  }, [])

  // 简单的布尔值不需要 useMemo
  const hasError = error !== null

  // 使用 useMemo 避免 filters 对象每次渲染都创建新引用
  const filters = useMemo(
    () => ({
      searchQuery: searchInput,
      filterStatus,
      selectedTags,
      sortBy,
      viewMode,
      itemsPerPage: pageSize,
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      totalItems: pagination.totalItems,
    }),
    [
      searchInput,
      filterStatus,
      selectedTags,
      sortBy,
      viewMode,
      pageSize,
      pagination.currentPage,
      pagination.totalPages,
      pagination.totalItems,
    ]
  )

  return {
    posts,
    stats,
    availableTags,
    filters,
    isLoading,
    isFetching,
    error,
    hasError,
    setSearchQuery: setSearchInput,
    setFilterStatus: (status: FilterStatus) => {
      setFilterStatus(status)
      setPage(1)
    },
    toggleTag,
    clearFilters,
    setSortBy: (value: SortOption) => {
      setSortBy(value)
      setPage(1)
    },
    setItemsPerPage: (value: number) => {
      setPageSize(value)
      setPage(1)
    },
    setViewMode,
    setPage: (value: number) => {
      setPage(Math.max(1, value))
    },
    refetch: fetchPosts,
    handleDelete,
    handleTogglePin,
    handleTogglePublish,
  }
}
