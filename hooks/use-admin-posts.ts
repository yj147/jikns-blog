"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import useSWR from "swr"
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

interface ApiPostItem {
  id: string
  slug: string
  title: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  coverImage: string | null
   signedCoverImage?: string | null
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
    coverImage: post.coverImage || post.signedCoverImage || undefined,
    signedCoverImage: post.signedCoverImage || undefined,
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

interface AdminPostsApiPayload {
  success: boolean
  data?: AdminPostsApiResponse
  error?: {
    message?: string
    code?: string
  }
}

async function fetchAdminPosts(url: string): Promise<AdminPostsApiResponse> {
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`请求失败: ${response.status}`)
  }

  const payload = (await response.json()) as AdminPostsApiPayload

  if (!payload.success || !payload.data) {
    throw new Error(payload.error?.message || "获取文章列表失败")
  }

  return payload.data
}

export function useAdminPosts() {
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQueryState] = useState("")
  const [filterStatus, setFilterStatusState] = useState<FilterStatus>("all")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sortBy, setSortByState] = useState<SortOption>("newest")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [page, setPageState] = useState(1)
  const [pageSize, setPageSizeState] = useState(12)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQueryState((current) => (current !== searchInput ? searchInput : current))
      setPageState(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set("page", page.toString())
    params.set("limit", pageSize.toString())
    if (searchQuery) params.set("search", searchQuery)
    if (filterStatus !== "all") params.set("status", filterStatus)
    if (sortBy !== "newest") params.set("sort", sortBy)
    selectedTags.forEach((tag) => params.append("tag", tag))
    return params.toString()
  }, [filterStatus, page, pageSize, searchQuery, selectedTags, sortBy])

  useEffect(() => {
    setActionError(null)
  }, [queryString])

  const endpoint = useMemo(() => `/api/admin/posts?${queryString}`, [queryString])

  const { data, error: swrError, isLoading, isValidating, mutate } = useSWR<AdminPostsApiResponse>(
    endpoint,
    fetchAdminPosts,
    {
      revalidateOnMount: true,
      dedupingInterval: 5000,
    }
  )

  const swrErrorMessage = swrError ? (swrError instanceof Error ? swrError.message : String(swrError)) : null

  useEffect(() => {
    if (!swrErrorMessage) return
    toast.error(`获取文章列表失败: ${swrErrorMessage}`)
  }, [swrErrorMessage])

  const paginationInfo = data?.pagination

  useEffect(() => {
    if (!paginationInfo) return
    setPageState((prev) => (prev === paginationInfo.page ? prev : paginationInfo.page))
    setPageSizeState((prev) => (prev === paginationInfo.limit ? prev : paginationInfo.limit))
  }, [paginationInfo])

  const posts = useMemo(() => {
    if (!data) return []
    return data.items.map(mapApiPostToCard)
  }, [data])

  const stats = data?.stats ?? DEFAULT_STATS
  const availableTags = data?.availableTags ?? []
  const resolvedItemsPerPage = paginationInfo?.limit ?? pageSize
  const resolvedPage = paginationInfo?.page ?? page
  const resolvedTotalPages = paginationInfo?.totalPages ?? 1
  const resolvedTotalItems = paginationInfo?.total ?? 0

  const isFetching = isValidating && !isLoading
  const combinedError = swrErrorMessage ?? actionError
  const hasError = combinedError !== null

  const refreshAdminPosts = useCallback(() => {
    setActionError(null)
    return mutate()
  }, [mutate])

  const handleDelete = useCallback(
    async (post: Post) => {
      try {
        const result = await deletePost(post.id)
        if (result.success) {
          toast.success("文章删除成功")
          await refreshAdminPosts()
        } else {
          const friendly = resolveErrorMessage(result.error?.code, result.error?.message)
          setActionError(friendly)
          toast.error(`删除文章失败: ${friendly}`)
        }
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
        setActionError(message)
        toast.error("删除文章失败")
      }
    },
    [refreshAdminPosts]
  )

  const handleTogglePin = useCallback(
    async (post: Post) => {
      try {
        const result = await togglePinPost(post.id)
        if (result.success) {
          toast.success(result.data?.message || "操作成功")
          await refreshAdminPosts()
        } else {
          const friendly = resolveErrorMessage(result.error?.code, result.error?.message)
          setActionError(friendly)
          toast.error(`切换置顶状态失败: ${friendly}`)
        }
      } catch (toggleError) {
        const message = toggleError instanceof Error ? toggleError.message : String(toggleError)
        setActionError(message)
        toast.error("切换置顶状态失败")
      }
    },
    [refreshAdminPosts]
  )

  const handleTogglePublish = useCallback(
    async (post: Post) => {
      try {
        const result = post.isPublished ? await unpublishPost(post.id) : await publishPost(post.id)
        if (result.success) {
          toast.success(result.data?.message || "操作成功")
          await refreshAdminPosts()
        } else {
          const friendly = resolveErrorMessage(result.error?.code, result.error?.message)
          setActionError(friendly)
          toast.error(`切换发布状态失败: ${friendly}`)
        }
      } catch (toggleError) {
        const message = toggleError instanceof Error ? toggleError.message : String(toggleError)
        setActionError(message)
        toast.error("切换发布状态失败")
      }
    },
    [refreshAdminPosts]
  )

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const exists = prev.includes(tag)
      return exists ? prev.filter((item) => item !== tag) : [...prev, tag]
    })
    setPageState(1)
  }, [])

  const clearFilters = useCallback(() => {
    setSearchInput("")
    setSearchQueryState("")
    setSelectedTags([])
    setFilterStatusState("all")
    setSortByState("newest")
    setPageState(1)
  }, [])

  const filters = useMemo(
    () => ({
      searchQuery: searchInput,
      filterStatus,
      selectedTags,
      sortBy,
      viewMode,
      itemsPerPage: resolvedItemsPerPage,
      currentPage: resolvedPage,
      totalPages: resolvedTotalPages,
      totalItems: resolvedTotalItems,
    }),
    [
      searchInput,
      filterStatus,
      selectedTags,
      sortBy,
      viewMode,
      resolvedItemsPerPage,
      resolvedPage,
      resolvedTotalPages,
      resolvedTotalItems,
    ]
  )

  return {
    posts,
    stats,
    availableTags,
    filters,
    isLoading,
    isFetching,
    error: combinedError,
    hasError,
    setSearchQuery: setSearchInput,
    setFilterStatus: (status: FilterStatus) => {
      setFilterStatusState(status)
      setPageState(1)
    },
    toggleTag,
    clearFilters,
    setSortBy: (value: SortOption) => {
      setSortByState(value)
      setPageState(1)
    },
    setItemsPerPage: (value: number) => {
      setPageSizeState(value)
      setPageState(1)
    },
    setViewMode,
    setPage: (value: number) => {
      setPageState(Math.max(1, value))
    },
    refetch: refreshAdminPosts,
    handleDelete,
    handleTogglePin,
    handleTogglePublish,
  }
}
