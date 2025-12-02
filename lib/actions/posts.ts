"use server"

/**
 * Post CRUD Server Actions - Phase 5.1.2
 * 实现完整的文章管理后端逻辑，包括 CRUD 操作和权限控制
 */

import { revalidatePath, revalidateTag } from "next/cache"
import { revalidateArchiveCache } from "@/lib/actions/archive-cache"
import { enqueueNewPostNotification } from "@/lib/services/email-queue"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireAdmin } from "@/lib/auth"
import { recalculateTagCounts, syncPostTags } from "@/lib/repos/tag-repo"
import { validateSlug } from "@/lib/utils/slug"
import { createUniqueSmartSlug } from "@/lib/utils/slug-english"
import { logger } from "@/lib/utils/logger"
import { AuditEventType, auditLogger } from "@/lib/audit-log"
import { getServerContext } from "@/lib/server-context"
import { createSignedUrlIfNeeded, signAvatarUrl } from "@/lib/storage/signed-url"

function resolveErrorCode(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    if (
      message.includes("至少") ||
      message.includes("不能超过") ||
      message.includes("格式不正确") ||
      message.includes("请提供有效") ||
      message.includes("不能为空") ||
      message.includes("重复提交") ||
      message.includes("长度")
    ) {
      return "VALIDATION_ERROR"
    }

    if (
      message.includes("已被使用") ||
      message.includes("已经发布") ||
      message.includes("尚未发布") ||
      message.includes("占用")
    ) {
      return "CONFLICT"
    }

    if (message.includes("slug") && !message.includes("占用")) {
      return "VALIDATION_ERROR"
    }

    if (message.includes("不存在")) {
      return "NOT_FOUND"
    }

    if (message.includes("forbidden") || message.includes("权限") || message.includes("未授权")) {
      return "FORBIDDEN"
    }

    if (message.includes("未登录") || message.includes("请登录")) {
      return "AUTHENTICATION_REQUIRED"
    }
  }

  return fallback
}

type PostAuditAction =
  | "POST_CREATE"
  | "POST_UPDATE"
  | "POST_DELETE"
  | "POST_BULK_DELETE"
  | "POST_PUBLISH"
  | "POST_UNPUBLISH"
  | "POST_TOGGLE_PIN"

const POST_IMAGE_SIGN_EXPIRES_IN = 60 * 60

async function signPostCoverImage(coverImage: string | null): Promise<string | null> {
  if (!coverImage) return null
  return createSignedUrlIfNeeded(coverImage, POST_IMAGE_SIGN_EXPIRES_IN, "post-images")
}

async function signPostContent(content: string | null | undefined): Promise<string | null | undefined> {
  if (!content) return content ?? null

  const storageUrlPattern =
    /(https?:\/\/[^\s)]+\/storage\/v1\/object\/(?:public|sign)\/post-images\/[^\s)]+)/gi
  const matches = Array.from(new Set(content.match(storageUrlPattern) ?? []))
  if (matches.length === 0) {
    return content
  }

  const replacements = await Promise.all(
    matches.map(async (original) => {
      const signed = await createSignedUrlIfNeeded(
        original,
        POST_IMAGE_SIGN_EXPIRES_IN,
        "post-images"
      )
      return [original, signed ?? original] as const
    })
  )

  return replacements.reduce((acc, [original, signed]) => acc.replaceAll(original, signed), content)
}

async function recordPostAudit(params: {
  action: PostAuditAction
  success: boolean
  adminId?: string
  postId?: string
  errorCode?: string
  errorMessage?: string
}): Promise<void> {
  const context = await getServerContext()
  const details =
    params.errorCode !== undefined
      ? {
          errorCode: params.errorCode,
        }
      : undefined

  await auditLogger.logEvent({
    eventType: AuditEventType.ADMIN_ACTION,
    action: params.action,
    resource: params.postId,
    userId: params.adminId,
    success: params.success,
    details,
    errorMessage: params.errorMessage,
    severity: params.success ? "LOW" : "MEDIUM",
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  })
}

async function resolvePostSlug(
  title: string,
  inputSlug?: string
): Promise<{ slug: string; source: "custom" | "auto" }> {
  const trimmedSlug = inputSlug?.trim()

  if (trimmedSlug) {
    const normalizedSlug = trimmedSlug.toLowerCase()
    const validation = validateSlug(normalizedSlug)

    if (!validation.isValid) {
      throw new Error(validation.errors[0])
    }

    const existing = await prisma.post.findUnique({
      where: { slug: normalizedSlug },
    })

    if (existing) {
      throw new Error("Slug 已被占用，请更换其他 URL")
    }

    return { slug: normalizedSlug, source: "custom" }
  }

  const autoSlug = await createUniqueSmartSlug(
    title,
    async (candidateSlug: string) => {
      const existing = await prisma.post.findUnique({
        where: { slug: candidateSlug },
      })
      return !!existing
    },
    60
  )

  return { slug: autoSlug, source: "auto" }
}

// ============================================================================
// 类型定义 (内联定义避免导出类型冲突)
// ============================================================================

interface CreatePostRequest {
  title: string
  content: string
  excerpt?: string
  published?: boolean
  slug?: string
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
  contentSigned?: string | null
  excerpt: string | null
  published: boolean
  isPinned: boolean
  canonicalUrl: string | null
  seoTitle: string | null
  seoDescription: string | null
  coverImage: string | null
  signedCoverImage?: string | null
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
  contentLength: number
  author: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  signedCoverImage?: string | null
  tags: {
    name: string
    slug: string
    color: string | null
  }[]
  stats: PostStats
}

type AdminPostsSearchParams = Omit<PostsSearchParams, "published">

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
  let admin: { id: string } | null = null
  try {
    // 验证管理员权限
    admin = await requireAdmin()

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

    const { slug } = await resolvePostSlug(trimmedTitle, data.slug)

    const incomingTagNames = Array.isArray(data.tagNames) ? data.tagNames : []

    if (!admin) {
      throw new Error("管理员身份验证失败")
    }
    const adminId = admin.id

    // 执行数据库事务
    const { post: result, tagsAffected } = await prisma.$transaction(async (tx) => {
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
          authorId: adminId,
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

      let tagsTouched = false
      if (incomingTagNames.length > 0) {
        const { tagIds } = await syncPostTags({
          tx,
          postId: post.id,
          newTagNames: incomingTagNames,
        })
        tagsTouched = tagIds.length > 0
      }

      // 返回完整的文章信息
      const fullPost = await tx.post.findUnique({
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

      if (!fullPost) {
        throw new Error("创建文章失败")
      }

      return { post: fullPost, tagsAffected: tagsTouched }
    })

    if (tagsAffected) {
      revalidateTag("tags:list")
      revalidateTag("tags:detail")
    }

    await revalidateArchiveCache({
      nextPublished: result.published,
      nextPublishedAt: result.publishedAt,
    })

    await recordPostAudit({
      action: "POST_CREATE",
      success: true,
      adminId,
      postId: result.id,
    })

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
    const code = resolveErrorCode(error, "AUTH_INSUFFICIENT_PERMISSIONS")
    logger.error(
      "创建文章失败",
      {
        module: "lib/actions/posts",
        action: "createPost",
        titleLength: data.title?.length ?? 0,
        hasCustomSlug: Boolean(data.slug?.trim()),
        published: data.published ?? false,
        errorCode: code,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      error
    )
    await recordPostAudit({
      action: "POST_CREATE",
      success: false,
      adminId: admin?.id,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : undefined,
    })
    return {
      success: false,
      error: {
        code,
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
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          published: true,
          isPinned: true,
          coverImage: true,
          viewCount: true,
          publishedAt: true,
          createdAt: true,
          content: true, // 需要完整内容来计算长度
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

    // 签名媒体 URL
    const signedAvatars = await Promise.all(
      posts.map((post) => signAvatarUrl(post.author.avatarUrl))
    )
    const signedCoverImages = await Promise.all(
      posts.map((post) => signPostCoverImage(post.coverImage))
    )

    // 格式化响应数据
    const data: PostListResponse[] = posts.map((post, index) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      published: post.published,
      isPinned: post.isPinned,
      coverImage: post.coverImage,
      signedCoverImage: signedCoverImages[index],
      viewCount: post.viewCount,
      publishedAt: post.publishedAt?.toISOString() || null,
      createdAt: post.createdAt.toISOString(),
      author: {
        ...post.author,
        avatarUrl: signedAvatars[index] ?? post.author.avatarUrl,
      },
      tags: post.tags.map((pt) => pt.tag),
      stats: {
        commentsCount: post._count.comments,
        likesCount: post._count.likes,
        bookmarksCount: post._count.bookmarks,
      },
      contentLength: post.content.length, // 内容长度
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
    logger.error("获取文章列表失败", { module: "lib/actions/posts", action: "getPosts" }, error)
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
 * 获取管理员视角的文章列表（不过滤发布状态）
 */
export async function getPostsForAdmin(
  params: AdminPostsSearchParams = {}
): Promise<PaginatedApiResponse<PostListResponse>> {
  await requireAdmin()
  return getPosts(params as PostsSearchParams)
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

    const [signedCoverImage, signedAvatar, signedContent] = await Promise.all([
      signPostCoverImage(post.coverImage),
      signAvatarUrl(post.author.avatarUrl),
      signPostContent(post.content),
    ])

    // 格式化响应
    const response: PostResponse = {
      id: post.id,
      slug: post.slug,
      title: post.title,
      content: post.content,
      contentSigned: signedContent ?? undefined,
      excerpt: post.excerpt,
      published: post.published,
      isPinned: post.isPinned,
      canonicalUrl: post.canonicalUrl,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      coverImage: post.coverImage,
      signedCoverImage,
      viewCount: post.viewCount,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString() || null,
      author: {
        ...post.author,
        avatarUrl: signedAvatar ?? post.author.avatarUrl,
      },
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
    logger.error("获取文章失败", { module: "lib/actions/posts", action: "getPost" }, error)
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
  let admin: { id: string } | null = null
  try {
    // 验证管理员权限
    admin = await requireAdmin()

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
    const { post: result, tagsAffected } = await prisma.$transaction(async (tx) => {
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
      await tx.post.update({
        where: { id },
        data: updatePayload,
      })

      let tagsTouched = false

      if (updateData.tagNames !== undefined) {
        await syncPostTags({
          tx,
          postId: id,
          newTagNames: updateData.tagNames ?? [],
          existingPostTags: existingPost.tags,
        })
        tagsTouched = true
      }

      const publishedChanged =
        updateData.published !== undefined && updateData.published !== existingPost.published

      if (publishedChanged) {
        const relatedTags = await tx.postTag.findMany({
          where: { postId: id },
          select: { tagId: true },
        })
        const tagIds = relatedTags.map((relation) => relation.tagId)
        await recalculateTagCounts(tx, tagIds)
        if (tagIds.length > 0) {
          tagsTouched = true
        }
      }

      const fullPost = await tx.post.findUnique({
        where: { id },
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

      if (!fullPost) {
        throw new Error("更新文章失败")
      }

      return { post: fullPost, tagsAffected: tagsTouched }
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${existingPost.slug}`)
    if (newSlug !== existingPost.slug) {
      revalidatePath(`/blog/${newSlug}`)
    }

    if (tagsAffected) {
      revalidateTag("tags:list")
      revalidateTag("tags:detail")
    }

    await revalidateArchiveCache({
      previousPublished: existingPost.published,
      previousPublishedAt: existingPost.publishedAt,
      nextPublished: result.published,
      nextPublishedAt: result.publishedAt,
    })

    await recordPostAudit({
      action: "POST_UPDATE",
      success: true,
      adminId: admin.id,
      postId: result.id,
    })

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
    logger.error("更新文章失败", { module: "lib/actions/posts", action: "updatePost" }, error)
    const code = resolveErrorCode(error, "INTERNAL_ERROR")
    await recordPostAudit({
      action: "POST_UPDATE",
      success: false,
      adminId: admin?.id,
      postId: data.id,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : undefined,
    })
    return {
      success: false,
      error: {
        code,
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
  let admin: { id: string } | null = null
  try {
    // 验证管理员权限
    admin = await requireAdmin()
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

    const affectedTagIds = existingPost.tags.map((postTag) => postTag.tag.id)

    // 执行事务删除
    await prisma.$transaction(async (tx) => {
      // 删除文章（Prisma 会自动处理级联删除）
      await tx.post.delete({
        where: { id: postId },
      })

      if (affectedTagIds.length > 0) {
        await recalculateTagCounts(tx, affectedTagIds)
      }
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${existingPost.slug}`)

    if (affectedTagIds.length > 0) {
      revalidateTag("tags:list")
      revalidateTag("tags:detail")
    }

    await revalidateArchiveCache({
      previousPublished: existingPost.published,
      previousPublishedAt: existingPost.publishedAt,
    })

    await recordPostAudit({
      action: "POST_DELETE",
      success: true,
      adminId: admin.id,
      postId,
    })

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
    logger.error("删除文章失败", { module: "lib/actions/posts", action: "deletePost" }, error)
    const code = resolveErrorCode(error, "INTERNAL_ERROR")
    await recordPostAudit({
      action: "POST_DELETE",
      success: false,
      adminId: admin?.id,
      postId,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : undefined,
    })
    return {
      success: false,
      error: {
        code,
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
  let admin: { id: string } | null = null
  try {
    // 验证管理员权限
    admin = await requireAdmin()
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        tags: {
          select: { tagId: true },
        },
      },
    })

    if (!post) {
      throw new Error("文章不存在")
    }

    if (post.published) {
      throw new Error("文章已经发布")
    }

    const tagIds = post.tags.map((relation) => relation.tagId)

    const updatedPost = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          published: true,
          publishedAt: new Date(),
        },
      })

      if (tagIds.length > 0) {
        await recalculateTagCounts(tx, tagIds)
      }

      return updated
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${updatedPost.slug}`)

    if (tagIds.length > 0) {
      revalidateTag("tags:list")
      revalidateTag("tags:detail")
    }

    await revalidateArchiveCache({
      previousPublished: post.published,
      previousPublishedAt: post.publishedAt,
      nextPublished: updatedPost.published,
      nextPublishedAt: updatedPost.publishedAt,
    })

    await recordPostAudit({
      action: "POST_PUBLISH",
      success: true,
      adminId: admin.id,
      postId,
    })

    enqueueNewPostNotification(postId).catch((error) => {
      logger.warn("发布邮件通知入队失败", {
        postId,
        error: error instanceof Error ? error.message : String(error),
      })
    })

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
    logger.error("发布文章失败", { module: "lib/actions/posts", action: "publishPost" }, error)
    const code = resolveErrorCode(error, "INTERNAL_ERROR")
    await recordPostAudit({
      action: "POST_PUBLISH",
      success: false,
      adminId: admin?.id,
      postId,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : undefined,
    })
    return {
      success: false,
      error: {
        code,
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
  let admin: { id: string } | null = null
  try {
    // 验证管理员权限
    admin = await requireAdmin()
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        tags: {
          select: { tagId: true },
        },
      },
    })

    if (!post) {
      throw new Error("文章不存在")
    }

    if (!post.published) {
      throw new Error("文章尚未发布")
    }

    const tagIds = post.tags.map((relation) => relation.tagId)

    const updatedPost = await prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          published: false,
          publishedAt: null,
        },
      })

      if (tagIds.length > 0) {
        await recalculateTagCounts(tx, tagIds)
      }

      return updated
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${updatedPost.slug}`)

    if (tagIds.length > 0) {
      revalidateTag("tags:list")
      revalidateTag("tags:detail")
    }

    await revalidateArchiveCache({
      previousPublished: post.published,
      previousPublishedAt: post.publishedAt,
      nextPublished: updatedPost.published,
      nextPublishedAt: updatedPost.publishedAt,
    })

    await recordPostAudit({
      action: "POST_UNPUBLISH",
      success: true,
      adminId: admin.id,
      postId,
    })

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
    logger.error(
      "取消发布文章失败",
      { module: "lib/actions/posts", action: "unpublishPost" },
      error
    )
    const code = resolveErrorCode(error, "INTERNAL_ERROR")
    await recordPostAudit({
      action: "POST_UNPUBLISH",
      success: false,
      adminId: admin?.id,
      postId,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : undefined,
    })
    return {
      success: false,
      error: {
        code,
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
  let admin: { id: string } | null = null
  try {
    // 验证管理员权限
    admin = await requireAdmin()
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

    await recordPostAudit({
      action: "POST_TOGGLE_PIN",
      success: true,
      adminId: admin.id,
      postId,
    })

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
    logger.error(
      "切换置顶状态失败",
      { module: "lib/actions/posts", action: "togglePostPin" },
      error
    )
    const code = resolveErrorCode(error, "INTERNAL_ERROR")
    await recordPostAudit({
      action: "POST_TOGGLE_PIN",
      success: false,
      adminId: admin?.id,
      postId,
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : undefined,
    })
    return {
      success: false,
      error: {
        code,
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
  let admin: { id: string } | null = null
  try {
    // 验证管理员权限
    admin = await requireAdmin()
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

    const affectedTagIds = new Set<string>()
    for (const post of posts) {
      for (const postTag of post.tags) {
        affectedTagIds.add(postTag.tag.id)
      }
    }

    // 执行批量删除事务
    await prisma.$transaction(async (tx) => {
      // 批量删除文章
      await tx.post.deleteMany({
        where: { id: { in: postIds } },
      })

      if (affectedTagIds.size > 0) {
        await recalculateTagCounts(tx, Array.from(affectedTagIds))
      }
    })

    // 重新验证相关页面缓存
    revalidatePath("/admin/posts")
    revalidatePath("/blog")

    if (affectedTagIds.size > 0) {
      revalidateTag("tags:list")
      revalidateTag("tags:detail")
    }

    await revalidateArchiveCache(
      posts.map((post) => ({
        previousPublished: post.published,
        previousPublishedAt: post.publishedAt,
      }))
    )

    await recordPostAudit({
      action: "POST_BULK_DELETE",
      success: true,
      adminId: admin.id,
      postId: postIds.join(","),
    })

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
    logger.error(
      "批量删除文章失败",
      { module: "lib/actions/posts", action: "bulkDeletePosts" },
      error
    )
    const code = resolveErrorCode(error, "INTERNAL_ERROR")
    await recordPostAudit({
      action: "POST_BULK_DELETE",
      success: false,
      adminId: admin?.id,
      postId: postIds.join(","),
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : undefined,
    })
    return {
      success: false,
      error: {
        code,
        message: error instanceof Error ? error.message : "批量删除文章失败",
        timestamp: Date.now(),
      },
    }
  }
}
