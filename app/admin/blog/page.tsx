"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { PostList } from "@/components/admin/post-list"
import { type Post } from "@/components/admin/post-card"
import {
  getPosts,
  deletePost,
  togglePinPost,
  publishPost,
  unpublishPost,
} from "@/lib/actions/posts"
import { toast } from "sonner"

// Mock posts data - 将来会被实际 API 调用替换
const mockPosts: Post[] = [
  {
    id: "1",
    title: "现代Web开发的最佳实践与思考",
    slug: "modern-web-development-best-practices",
    summary:
      "探讨现代Web开发中的关键技术和最佳实践，从性能优化到用户体验设计，为开发者提供实用指南。",
    content: "# 现代Web开发的最佳实践\n\n本文将深入探讨...",
    coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=400&fit=crop",
    tags: ["技术", "Web开发", "最佳实践"],
    isPublished: true,
    isPinned: true,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-16"),
    views: 1250,
    likes: 89,
    comments: 23,
    author: {
      id: "admin",
      name: "管理员",
      avatar: "/author-writing.png",
    },
  },
  {
    id: "2",
    title: "AI时代的设计思维转变",
    slug: "ai-design-thinking-transformation",
    summary: "AI技术正在重新定义设计领域，让我们一起探索如何适应这种变革。",
    content: "# AI时代的设计思维\n\n人工智能技术...",
    tags: ["设计", "AI", "思维"],
    isPublished: false,
    isPinned: false,
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-12"),
    views: 0,
    likes: 0,
    comments: 0,
    author: {
      id: "admin",
      name: "管理员",
    },
  },
  {
    id: "3",
    title: "构建可持续的开源项目",
    slug: "sustainable-open-source-projects",
    summary: "开源项目的成功不仅在于技术，更在于社区的建设和可持续发展。",
    content: "# 构建可持续的开源项目\n\n开源项目...",
    coverImage: "https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&h=400&fit=crop",
    tags: ["开源", "项目管理", "社区"],
    isPublished: true,
    isPinned: false,
    createdAt: new Date("2024-01-05"),
    updatedAt: new Date("2024-01-06"),
    views: 890,
    likes: 45,
    comments: 12,
    author: {
      id: "admin",
      name: "管理员",
    },
  },
  {
    id: "4",
    title: "微服务架构的实践与反思",
    slug: "microservices-practice-and-reflection",
    summary: "从单体应用到微服务架构的演进历程，以及实践中的经验与教训。",
    content: "# 微服务架构的实践\n\n微服务架构...",
    tags: ["架构", "微服务", "后端"],
    isPublished: true,
    isPinned: false,
    createdAt: new Date("2024-01-08"),
    updatedAt: new Date("2024-01-09"),
    views: 1100,
    likes: 78,
    comments: 28,
    author: {
      id: "admin",
      name: "管理员",
    },
  },
]

export default function AdminBlogPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 获取文章列表
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setIsLoading(true)
        const result = await getPosts({ limit: 50, orderBy: "updatedAt" })

        if (result.success) {
          // 转换数据格式以匹配组件接口
          const transformedPosts: Post[] = result.data.map((post) => ({
            id: post.id,
            title: post.title,
            slug: post.slug,
            summary: post.excerpt || undefined,
            content: "", // 列表页面不需要完整内容
            coverImage: post.coverImage || undefined,
            tags: post.tags.map((tag) => tag.name),
            isPublished: post.published,
            isPinned: post.isPinned,
            createdAt: new Date(post.createdAt),
            updatedAt: new Date(post.publishedAt || post.createdAt),
            views: post.viewCount,
            likes: post.stats.likesCount,
            comments: post.stats.commentsCount,
            author: {
              id: post.author.id,
              name: post.author.name || "管理员",
              avatar: post.author.avatarUrl || undefined,
            },
          }))

          setPosts(transformedPosts)
        } else {
          toast.error("获取文章列表失败: " + result.error?.message)
          // 使用 mock 数据作为后备
          setPosts(mockPosts)
        }
      } catch (error) {
        console.error("获取文章列表出错:", error)
        toast.error("获取文章列表失败")
        // 使用 mock 数据作为后备
        setPosts(mockPosts)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPosts()
  }, [])

  // 编辑文章
  const handleEdit = (post: Post) => {
    router.push(`/admin/blog/edit/${post.id}`)
  }

  // 删除文章
  const handleDelete = async (post: Post) => {
    try {
      const result = await deletePost(post.id)

      if (result.success) {
        setPosts((prevPosts) => prevPosts.filter((p) => p.id !== post.id))
        toast.success("文章删除成功")
      } else {
        toast.error("删除文章失败: " + result.error?.message)
      }
    } catch (error) {
      console.error("删除文章失败:", error)
      toast.error("删除文章失败")
    }
  }

  // 切换置顶状态
  const handleTogglePin = async (post: Post) => {
    try {
      const result = await togglePinPost(post.id)

      if (result.success) {
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === post.id ? { ...p, isPinned: result.data?.isPinned ?? !p.isPinned } : p
          )
        )
        toast.success(result.data?.message || "操作成功")
      } else {
        toast.error("切换置顶状态失败: " + result.error?.message)
      }
    } catch (error) {
      console.error("切换置顶状态失败:", error)
      toast.error("切换置顶状态失败")
    }
  }

  // 切换发布状态
  const handleTogglePublish = async (post: Post) => {
    try {
      const result = post.isPublished ? await unpublishPost(post.id) : await publishPost(post.id)

      if (result.success) {
        setPosts((prevPosts) =>
          prevPosts.map((p) => (p.id === post.id ? { ...p, isPublished: !post.isPublished } : p))
        )
        toast.success(result.data?.message || "操作成功")
      } else {
        toast.error("切换发布状态失败: " + result.error?.message)
      }
    } catch (error) {
      console.error("切换发布状态失败:", error)
      toast.error("切换发布状态失败")
    }
  }

  // 创建新文章
  const handleCreateNew = () => {
    router.push("/admin/blog/create")
  }

  return (
    <div className="bg-background min-h-screen">
      <Navigation />

      <div className="container mx-auto px-4 py-8">
        <PostList
          posts={posts}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTogglePin={handleTogglePin}
          onTogglePublish={handleTogglePublish}
          onCreateNew={handleCreateNew}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
