"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { PostList } from "@/components/admin/post-list"
import type { Post } from "@/components/admin/post-card"
import { deletePost, publishPost, togglePinPost, unpublishPost } from "@/lib/actions/posts"
import { logger } from "@/lib/utils/logger"

export type AdminBlogPostDTO = {
  id: string
  title: string
  slug: string
  summary?: string | null
  coverImage?: string | null
  signedCoverImage?: string | null
  tags: string[]
  isPublished: boolean
  isPinned: boolean
  createdAt: string
  updatedAt: string
  views?: number
  likes?: number
  comments?: number
  author?: {
    id: string
    name: string | null
    avatar?: string | null
  }
}

export interface AdminBlogListClientProps {
  initialPosts: AdminBlogPostDTO[]
}

function deserializePost(post: AdminBlogPostDTO): Post {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    summary: post.summary ?? undefined,
    content: "",
    coverImage: post.signedCoverImage ?? post.coverImage ?? undefined,
    signedCoverImage: post.signedCoverImage ?? undefined,
    tags: post.tags,
    isPublished: post.isPublished,
    isPinned: post.isPinned,
    createdAt: new Date(post.createdAt),
    updatedAt: new Date(post.updatedAt),
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    author: post.author
      ? {
          id: post.author.id,
          name: post.author.name || "管理员",
          avatar: post.author.avatar ?? undefined,
        }
      : undefined,
    metaTitle: undefined,
    metaDescription: undefined,
  }
}

export default function AdminBlogListClient({ initialPosts }: AdminBlogListClientProps) {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>(() => initialPosts.map(deserializePost))

  const handleEdit = useCallback(
    (post: Post) => {
      router.push(`/admin/blog/edit/${post.id}`)
    },
    [router]
  )

  const handleCreateNew = useCallback(() => {
    router.push("/admin/blog/create")
  }, [router])

  const handleDelete = useCallback(async (post: Post) => {
    try {
      const result = await deletePost(post.id)

      if (result.success) {
        setPosts((prev) => prev.filter((item) => item.id !== post.id))
        toast.success("文章删除成功")
      } else {
        toast.error("删除文章失败: " + (result.error?.message ?? "未知错误"))
      }
    } catch (error) {
      logger.error(
        "删除文章失败",
        { module: "app/admin/blog/page", postId: post.id },
        error instanceof Error ? error : undefined
      )
      toast.error("删除文章失败")
    }
  }, [])

  const handleTogglePin = useCallback(async (post: Post) => {
    try {
      const result = await togglePinPost(post.id)

      if (result.success) {
        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? { ...item, isPinned: result.data?.isPinned ?? !item.isPinned }
              : item
          )
        )
        toast.success(result.data?.message ?? "操作成功")
      } else {
        toast.error("切换置顶状态失败: " + (result.error?.message ?? "未知错误"))
      }
    } catch (error) {
      logger.error(
        "切换置顶状态失败",
        { module: "app/admin/blog/page", postId: post.id },
        error instanceof Error ? error : undefined
      )
      toast.error("切换置顶状态失败")
    }
  }, [])

  const handleTogglePublish = useCallback(async (post: Post) => {
    try {
      const result = post.isPublished ? await unpublishPost(post.id) : await publishPost(post.id)

      if (result.success) {
        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id ? { ...item, isPublished: !item.isPublished } : item
          )
        )
        toast.success(result.data?.message ?? "操作成功")
      } else {
        toast.error("切换发布状态失败: " + (result.error?.message ?? "未知错误"))
      }
    } catch (error) {
      logger.error(
        "切换发布状态失败",
        { module: "app/admin/blog/page", postId: post.id },
        error instanceof Error ? error : undefined
      )
      toast.error("切换发布状态失败")
    }
  }, [])

  return (
    <PostList
      posts={posts}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onTogglePin={handleTogglePin}
      onTogglePublish={handleTogglePublish}
      onCreateNew={handleCreateNew}
      isLoading={false}
    />
  )
}
