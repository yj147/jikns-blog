"use server"

/**
 * Post CRUD Server Actions - Phase 5.1.2
 * 实现完整的文章管理后端逻辑，包括 CRUD 操作和权限控制
 */

import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireAdmin } from "@/lib/auth"
import { validateSlug } from "@/lib/utils/slug"
import { createUniqueSmartSlug } from "@/lib/utils/slug-english"

// ============================================================================
// 类型定义 (内联定义避免导出类型冲突)
// ============================================================================

interface CreatePostRequest {
  title: string
  content: string
  excerpt?: string
  published?: boolean
  canonicalUrl?: string
  seoTitle?: string
  seoDescription?: string
  coverImage?: string
  seriesId?: string
  tagNames?: string[]
}

interface UpdatePostRequest extends Partial<CreatePostRequest> {
  id: string
  slug?: string
}

interface PostsSearchParams {
  page?: number
  limit?: number
  q?: string
  published?: boolean
  authorId?: string
  seriesId?: string
  tag?: string
  fromDate?: string
  toDate?: string
  orderBy?: string
  order?: "asc" | "desc"
}

interface PostStats {
  commentsCount: number
  likesCount: number
  bookmarksCount: number
}

interface PostResponse {
  id: string
  slug: string
  title: string
  content: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  canonicalUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  coverImage: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
    bio?: string | null
  }
  series?: {
    id: string
    title: string
    slug: string
    description: string | null
  }
  tags: {
    id: string
    name: string
    slug: string
    color: string | null
  }[]
  stats: PostStats
}

interface PostListResponse {
  id: string
  slug: string
  title: string
  excerpt: string | null
  published: boolean
  isPinned: boolean
  coverImage: string | null
  viewCount: number
  publishedAt: string | null
  createdAt: string
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  tags: {
    name: string
    slug: string
    color: string | null
  }[]
  stats: PostStats
}

interface ApiError {
  code: string
  message: string
  timestamp: number
}

interface ApiMeta {
  requestId: string
  timestamp: number
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  data: T[]
  pagination: PaginationMeta
}

// ============================================================================
// 核心 CRUD 操作
// ============================================================================

/**
 * 创建文章 Server Action
 */
export async function createPost(data: CreatePostRequest): Promise<ApiResponse<PostResponse>> {
  try {
    // 验证管理员权限
    const admin = await requireAdmin()

    // 增强的输入验证
    const trimmedTitle = data.title?.trim() || ""
    const trimmedContent = data.content?.trim() || ""

    if (!trimmedTitle || trimmedTitle.length < 3) {
      throw new Error("文章标题至少需要3个字符")
    }

    if (trimmedTitle.length > 200) {
      throw new Error("文章标题不能超过200个字符")
    }

    if (!trimmedContent || trimmedContent.length < 10) {
      throw new Error("文章内容至少需要10个字符")
    }

    if (trimmedContent.length > 100000) {
      throw new Error("文章内容不能超过100,000个字符")
    }

    // 验证摘要长度
    if (data.excerpt && data.excerpt.trim().length > 500) {
      throw new Error("文章摘要不能超过500个字符")
    }

    // 验证 SEO 字段
    if (data.seoTitle && data.seoTitle.trim().length > 60) {
      throw new Error("SEO标题不能超过60个字符")
    }

    if (data.seoDescription && data.seoDescription.trim().length > 160) {
      throw new Error("SEO描述不能超过160个字符")
    }

    // 验证规范链接格式
    if (data.canonicalUrl && data.canonicalUrl.trim()) {
      try {
        new URL(data.canonicalUrl.trim())
      } catch {
        throw new Error("规范链接格式不正确，请提供有效的URL")
      }
    }

    // 自动生成唯一 slug（智能翻译中文为英文）
    const slug = await createUniqueSmartSlug(
      trimmedTitle,
      async (candidateSlug: string) => {
        const existing = await prisma.post.findUnique({
          where: { slug: candidateSlug },
        })
        return !!existing
      },
      60
    )

    // 处理标签
    let processedTags: string[] = []
    if (data.tagNames && data.tagNames.length > 0) {
      processedTags = data.tagNames
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .slice(0, 10) // 限制最多10个标签
    }

    // 执行数据库事务
    const result = await prisma.$transaction(async (tx) => {
      // 创建文章
      const post = await tx.post.create({
        data: {
          title: trimmedTitle,
          slug,
          content: trimmedContent,
          excerpt: data.excerpt?.trim() || null,
          published: data.published || false,
          publishedAt: data.published ? new Date() : null,
          canonicalUrl: data.canonicalUrl?.trim() || null,
          seoTitle: data.seoTitle?.trim() || null,
          seoDescription: data.seoDescription?.trim() || null,
          coverImage: data.coverImage?.trim() || null,
          authorId: admin.id,
          seriesId: data.seriesId || null,
        },
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true, bio: true },
          },
          series: {
            select: { id: true, title: true, slug: true, description: true },
          },
        },
      })

      // 处理标签关联
      const tagIds: string[] = []
      for (const tagName of processedTags) {
        const tagSlug = tagName
          .toLowerCase()
          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")

        // 先尝试查找现有标签
        let tag = await tx.tag.findFirst({
          where: {
            OR: [{ slug: tagSlug }, { name: tagName }],
          },
        })

        if (tag) {
          // 更新现有标签的帖子数量
          tag = await tx.tag.update({
            where: { id: tag.id },
            data: {
              postsCount: { increment: 1 },
            },
          })
        } else {
          // 创建新标签
          tag = await tx.tag.create({
            data: {
              name: tagName,
              slug: tagSlug,
              postsCount: 1,
            },
          })
        }

        // 创建文章-标签关联
        await tx.postTag.upsert({
          where: { postId_tagId: { postId: post.id, tagId: tag.id } },
          create: { postId: post.id, tagId: tag.id },
          update: {}, // 已存在则不做任何操作
        })

        tagIds.push(tag.id)
      }

      // 返回完整的文章信息
      return await tx.post.findUnique({
        where: { id: post.id },
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true, bio: true },
          },
          series: {
            select: { id: true, title: true, slug: true, description: true },
          },
          tags: {
            include: {
              tag: {
                select: { id: true, name: true, slug: true, color: true },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
              bookmarks: true,
            },
          },
        },
      })
    })

    if (!result) {
      throw new Error("创建文章失败")
    }

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    if (result.published) {
      revalidatePath(`/blog/${result.slug}`)
    }

    // 返回格式化的响应
    const response: PostResponse = {
      id: result.id,
      slug: result.slug,
      title: result.title,
      content: result.content,
      excerpt: result.excerpt,
      published: result.published,
      isPinned: result.isPinned,
      canonicalUrl: result.canonicalUrl,
      seoTitle: result.seoTitle,
      seoDescription: result.seoDescription,
      coverImage: result.coverImage,
      viewCount: result.viewCount,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      publishedAt: result.publishedAt?.toISOString() || null,
      author: result.author,
      series: result.series || undefined,
      tags: result.tags.map((pt) => pt.tag),
      stats: {
        commentsCount: result._count.comments,
        likesCount: result._count.likes,
        bookmarksCount: result._count.bookmarks,
      },
    }

    return {
      success: true,
      data: response,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("创建文章失败:", error)
    return {
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: error instanceof Error ? error.message : "创建文章失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 获取文章列表 Server Action
 */
export async function getPosts(
  params: PostsSearchParams = {}
): Promise<PaginatedApiResponse<PostListResponse>> {
  try {
    const {
      page = 1,
      limit = 10,
      q,
      published,
      authorId,
      seriesId,
      tag,
      fromDate,
      toDate,
      orderBy = "publishedAt",
      order = "desc",
    } = params

    // 构建查询条件
    const where: any = {}

    // 发布状态筛选
    if (published !== undefined) {
      where.published = published
    }

    // 作者筛选
    if (authorId) {
      where.authorId = authorId
    }

    // 系列筛选
    if (seriesId) {
      where.seriesId = seriesId
    }

    // 标签筛选
    if (tag) {
      where.tags = {
        some: {
          tag: {
            slug: tag,
          },
        },
      }
    }

    // 日期范围筛选
    if (fromDate || toDate) {
      where.publishedAt = {}
      if (fromDate) {
        where.publishedAt.gte = new Date(fromDate)
      }
      if (toDate) {
        where.publishedAt.lte = new Date(toDate)
      }
    }

    // 关键词搜索
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
      ]
    }

    // 执行分页查询
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true },
          },
          tags: {
            include: {
              tag: {
                select: { name: true, slug: true, color: true },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
              bookmarks: true,
            },
          },
        },
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    // 格式化响应数据
    const data: PostListResponse[] = posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      published: post.published,
      isPinned: post.isPinned,
      coverImage: post.coverImage,
      viewCount: post.viewCount,
      publishedAt: post.publishedAt?.toISOString() || null,
      createdAt: post.createdAt.toISOString(),
      author: post.author,
      tags: post.tags.map((pt) => pt.tag),
      stats: {
        commentsCount: post._count.comments,
        likesCount: post._count.likes,
        bookmarksCount: post._count.bookmarks,
      },
    }))

    const totalPages = Math.ceil(total / limit)

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("获取文章列表失败:", error)
    return {
      success: false,
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "获取文章列表失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 获取单篇文章 Server Action
 */
export async function getPost(
  slugOrId: string,
  options?: { incrementView?: boolean }
): Promise<ApiResponse<PostResponse>> {
  try {
    // 判断是 slug 还是 ID
    const isId = slugOrId.length > 20 // cuid 长度通常大于20
    const where = isId ? { id: slugOrId } : { slug: slugOrId }

    const post = await prisma.post.findUnique({
      where,
      include: {
        author: {
          select: { id: true, name: true, avatarUrl: true, bio: true },
        },
        series: {
          select: { id: true, title: true, slug: true, description: true },
        },
        tags: {
          include: {
            tag: {
              select: { id: true, name: true, slug: true, color: true },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
            bookmarks: true,
          },
        },
      },
    })

    if (!post) {
      return {
        success: false,
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "文章不存在",
          timestamp: Date.now(),
        },
      }
    }

    // 增加浏览量（仅对发布的文章）
    if (options?.incrementView && post.published) {
      await prisma.post.update({
        where: { id: post.id },
        data: { viewCount: { increment: 1 } },
      })
      post.viewCount += 1
    }

    // 格式化响应
    const response: PostResponse = {
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      excerpt: post.excerpt,
      published: post.published,
      isPinned: post.isPinned,
      canonicalUrl: post.canonicalUrl,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      coverImage: post.coverImage,
      viewCount: post.viewCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString() || null,
      author: post.author,
      series: post.series || undefined,
      tags: post.tags.map((pt) => pt.tag),
      stats: {
        commentsCount: post._count.comments,
        likesCount: post._count.likes,
        bookmarksCount: post._count.bookmarks,
      },
    }

    return {
      success: true,
      data: response,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("获取文章失败:", error)
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "获取文章失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 更新文章 Server Action
 */
export async function updatePost(data: UpdatePostRequest): Promise<ApiResponse<PostResponse>> {
  try {
    // 验证管理员权限
    await requireAdmin()

    const { id, ...updateData } = data

    // 验证文章存在
    const existingPost = await prisma.post.findUnique({
      where: { id },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    })

    if (!existingPost) {
      throw new Error("文章不存在")
    }

    // 增强的输入验证
    if (updateData.title !== undefined) {
      const trimmedTitle = updateData.title?.trim() || ""
      if (trimmedTitle.length < 3) {
        throw new Error("文章标题至少需要3个字符")
      }
      if (trimmedTitle.length > 200) {
        throw new Error("文章标题不能超过200个字符")
      }
    }

    if (updateData.content !== undefined) {
      const trimmedContent = updateData.content?.trim() || ""
      if (trimmedContent.length < 10) {
        throw new Error("文章内容至少需要10个字符")
      }
      if (trimmedContent.length > 100000) {
        throw new Error("文章内容不能超过100,000个字符")
      }
    }

    // 验证其他字段
    if (updateData.excerpt && updateData.excerpt.trim().length > 500) {
      throw new Error("文章摘要不能超过500个字符")
    }

    if (updateData.seoTitle && updateData.seoTitle.trim().length > 60) {
      throw new Error("SEO标题不能超过60个字符")
    }

    if (updateData.seoDescription && updateData.seoDescription.trim().length > 160) {
      throw new Error("SEO描述不能超过160个字符")
    }

    if (updateData.canonicalUrl && updateData.canonicalUrl.trim()) {
      try {
        new URL(updateData.canonicalUrl.trim())
      } catch {
        throw new Error("规范链接格式不正确，请提供有效的URL")
      }
    }

    // 处理 slug 更新
    let newSlug = existingPost.slug
    if (updateData.slug && updateData.slug !== existingPost.slug) {
      const validation = validateSlug(updateData.slug)
      if (!validation.isValid) {
        throw new Error(`Slug 格式不正确: ${validation.errors.join(", ")}`)
      }

      // 检查新 slug 是否已被使用
      const existingSlug = await prisma.post.findFirst({
        where: {
          slug: updateData.slug,
          id: { not: id },
        },
      })

      if (existingSlug) {
        throw new Error("此 URL 已被使用，请选择其他 URL")
      }

      newSlug = updateData.slug
    }

    // 执行事务更新
    const result = await prisma.$transaction(async (tx) => {
      // 准备更新数据
      const updatePayload: any = {
        ...(updateData.title && { title: updateData.title.trim() }),
        ...(updateData.content && { content: updateData.content.trim() }),
        ...(updateData.excerpt !== undefined && { excerpt: updateData.excerpt?.trim() || null }),
        ...(newSlug !== existingPost.slug && { slug: newSlug }),
        ...(updateData.canonicalUrl !== undefined && {
          canonicalUrl: updateData.canonicalUrl?.trim() || null,
        }),
        ...(updateData.seoTitle !== undefined && { seoTitle: updateData.seoTitle?.trim() || null }),
        ...(updateData.seoDescription !== undefined && {
          seoDescription: updateData.seoDescription?.trim() || null,
        }),
        ...(updateData.coverImage !== undefined && {
          coverImage: updateData.coverImage?.trim() || null,
        }),
        ...(updateData.seriesId !== undefined && { seriesId: updateData.seriesId || null }),
      }

      // 处理发布状态变化
      if (updateData.published !== undefined) {
        updatePayload.published = updateData.published
        if (updateData.published && !existingPost.published) {
          // 从草稿变为发布
          updatePayload.publishedAt = new Date()
        } else if (!updateData.published && existingPost.published) {
          // 从发布变为草稿
          updatePayload.publishedAt = null
        }
      }

      // 更新文章
      const updatedPost = await tx.post.update({
        where: { id },
        data: updatePayload,
        include: {
          author: {
            select: { id: true, name: true, avatarUrl: true, bio: true },
          },
          series: {
            select: { id: true, title: true, slug: true, description: true },
          },
          tags: {
            include: {
              tag: {
                select: { id: true, name: true, slug: true, color: true },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
              bookmarks: true,
            },
          },
        },
      })

      // 处理标签更新
      if (updateData.tagNames) {
        // 删除现有标签关联
        await tx.postTag.deleteMany({
          where: { postId: id },
        })

        // 更新旧标签计数
        for (const existingTag of existingPost.tags) {
          await tx.tag.update({
            where: { id: existingTag.tag.id },
            data: { postsCount: { decrement: 1 } },
          })
        }

        // 添加新标签关联
        const processedTags = updateData.tagNames
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0)
          .slice(0, 10) // 限制最多10个标签

        for (const tagName of processedTags) {
          const tagSlug = tagName
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")

          const tag = await tx.tag.upsert({
            where: { slug: tagSlug },
            create: {
              name: tagName,
              slug: tagSlug,
              postsCount: 1,
            },
            update: {
              postsCount: { increment: 1 },
            },
          })

          await tx.postTag.create({
            data: { postId: id, tagId: tag.id },
          })
        }
      }

      return updatedPost
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${existingPost.slug}`)
    if (newSlug !== existingPost.slug) {
      revalidatePath(`/blog/${newSlug}`)
    }

    // 格式化响应
    const response: PostResponse = {
      id: result.id,
      slug: result.slug,
      title: result.title,
      content: result.content,
      excerpt: result.excerpt,
      published: result.published,
      isPinned: result.isPinned,
      canonicalUrl: result.canonicalUrl,
      seoTitle: result.seoTitle,
      seoDescription: result.seoDescription,
      coverImage: result.coverImage,
      viewCount: result.viewCount,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      publishedAt: result.publishedAt?.toISOString() || null,
      author: result.author,
      series: result.series || undefined,
      tags: result.tags.map((pt) => pt.tag),
      stats: {
        commentsCount: result._count.comments,
        likesCount: result._count.likes,
        bookmarksCount: result._count.bookmarks,
      },
    }

    return {
      success: true,
      data: response,
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("更新文章失败:", error)
    return {
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: error instanceof Error ? error.message : "更新文章失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 删除文章 Server Action
 */
export async function deletePost(
  postId: string
): Promise<ApiResponse<{ id: string; message: string }>> {
  try {
    // 验证管理员权限
    await requireAdmin()
    // 验证文章存在
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    })

    if (!existingPost) {
      throw new Error("文章不存在")
    }

    // 执行事务删除
    await prisma.$transaction(async (tx) => {
      // 更新标签计数
      for (const postTag of existingPost.tags) {
        await tx.tag.update({
          where: { id: postTag.tag.id },
          data: { postsCount: { decrement: 1 } },
        })
      }

      // 删除文章（Prisma 会自动处理级联删除）
      await tx.post.delete({
        where: { id: postId },
      })
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${existingPost.slug}`)

    return {
      success: true,
      data: {
        id: postId,
        message: "文章删除成功",
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("删除文章失败:", error)
    return {
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: error instanceof Error ? error.message : "删除文章失败",
        timestamp: Date.now(),
      },
    }
  }
}

// ============================================================================
// 辅助操作
// ============================================================================

/**
 * 发布文章 Server Action
 */
export async function publishPost(
  postId: string
): Promise<ApiResponse<{ id: string; slug: string; publishedAt?: string; message: string }>> {
  try {
    // 验证管理员权限
    await requireAdmin()
    const post = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!post) {
      throw new Error("文章不存在")
    }

    if (post.published) {
      throw new Error("文章已经发布")
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        published: true,
        publishedAt: new Date(),
      },
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${updatedPost.slug}`)

    return {
      success: true,
      data: {
        id: postId,
        slug: updatedPost.slug,
        publishedAt: updatedPost.publishedAt?.toISOString(),
        message: "文章发布成功",
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("发布文章失败:", error)
    return {
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: error instanceof Error ? error.message : "发布文章失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 取消发布文章 Server Action
 */
export async function unpublishPost(
  postId: string
): Promise<ApiResponse<{ id: string; slug: string; message: string }>> {
  try {
    // 验证管理员权限
    await requireAdmin()
    const post = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!post) {
      throw new Error("文章不存在")
    }

    if (!post.published) {
      throw new Error("文章尚未发布")
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        published: false,
        publishedAt: null,
      },
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${updatedPost.slug}`)

    return {
      success: true,
      data: {
        id: postId,
        slug: updatedPost.slug,
        message: "文章已取消发布",
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("取消发布文章失败:", error)
    return {
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: error instanceof Error ? error.message : "取消发布文章失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 切换文章置顶状态 Server Action
 */
export async function togglePinPost(
  postId: string
): Promise<ApiResponse<{ id: string; isPinned: boolean; message: string }>> {
  try {
    // 验证管理员权限
    await requireAdmin()
    const post = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!post) {
      throw new Error("文章不存在")
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        isPinned: !post.isPinned,
      },
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    if (post.published) {
      revalidatePath(`/blog/${updatedPost.slug}`)
    }

    return {
      success: true,
      data: {
        id: postId,
        isPinned: updatedPost.isPinned,
        message: updatedPost.isPinned ? "文章已置顶" : "文章已取消置顶",
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("切换置顶状态失败:", error)
    return {
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: error instanceof Error ? error.message : "切换置顶状态失败",
        timestamp: Date.now(),
      },
    }
  }
}

/**
 * 批量删除文章 Server Action
 */
export async function bulkDeletePosts(
  postIds: string[]
): Promise<ApiResponse<{ deletedCount: number; message: string }>> {
  try {
    // 验证管理员权限
    await requireAdmin()
    if (!postIds || postIds.length === 0) {
      throw new Error("请至少选择一篇文章")
    }

    // 获取要删除的文章信息
    const posts = await prisma.post.findMany({
      where: { id: { in: postIds } },
      include: {
        tags: {
          include: { tag: true },
        },
      },
    })

    if (posts.length !== postIds.length) {
      throw new Error("部分文章不存在")
    }

    // 执行批量删除事务
    await prisma.$transaction(async (tx) => {
      // 更新标签计数
      for (const post of posts) {
        for (const postTag of post.tags) {
          await tx.tag.update({
            where: { id: postTag.tag.id },
            data: { postsCount: { decrement: 1 } },
          })
        }
      }

      // 批量删除文章
      await tx.post.deleteMany({
        where: { id: { in: postIds } },
      })
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")

    return {
      success: true,
      data: {
        deletedCount: posts.length,
        message: `成功删除 ${posts.length} 篇文章`,
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    }
  } catch (error) {
    console.error("批量删除文章失败:", error)
    return {
      success: false,
      error: {
        code: "AUTH_INSUFFICIENT_PERMISSIONS",
        message: error instanceof Error ? error.message : "批量删除文章失败",
        timestamp: Date.now(),
      },
    }
  }
}
