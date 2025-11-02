/**
 * 管理员文章管理 API
 * 提供文章的创建、编辑、删除、发布等管理员专用功能
 */

import { NextRequest } from "next/server"
import { withApiAuth, createSuccessResponse, createErrorResponse } from "@/lib/api-guards"
import { prisma } from "@/lib/prisma"
import { XSSProtection } from "@/lib/security"
import type { User } from "@/lib/generated/prisma"

/**
 * 获取所有文章列表（管理员视图）
 */
async function getPostsHandler(request: NextRequest, admin: User) {
  try {
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const published =
      searchParams.get("published") === "true"
        ? true
        : searchParams.get("published") === "false"
          ? false
          : undefined
    const seriesId = searchParams.get("seriesId") || undefined

    // 构建查询条件
    const where: any = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
      ]
    }

    if (published !== undefined) {
      where.published = published
    }

    if (seriesId) {
      where.seriesId = seriesId
    }

    // 分页查询
    const skip = (page - 1) * limit

    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          series: {
            select: {
              id: true,
              title: true,
              slug: true,
            },
          },
          tags: {
            include: {
              tag: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
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
      }),
      prisma.post.count({ where }),
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse(
      {
        posts,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      admin
    )
  } catch (error) {
    console.error("获取文章列表失败:", error)
    return createErrorResponse("获取文章列表失败", "GET_POSTS_FAILED", 500)
  }
}

/**
 * 创建新文章
 */
async function createPostHandler(request: NextRequest, admin: User) {
  try {
    const body = await request.json()
    const { title, content, excerpt, slug, published, seriesId, tags, seoTitle, seoDescription } =
      body

    // 验证必需字段
    if (!title || !content) {
      return createErrorResponse("标题和内容是必需的", "MISSING_REQUIRED_FIELDS", 400)
    }

    // XSS 防护
    title = XSSProtection.validateAndSanitizeInput(title)
    content = XSSProtection.validateAndSanitizeInput(content)
    excerpt = excerpt ? XSSProtection.validateAndSanitizeInput(excerpt) : null
    seoTitle = seoTitle ? XSSProtection.validateAndSanitizeInput(seoTitle) : null
    seoDescription = seoDescription ? XSSProtection.validateAndSanitizeInput(seoDescription) : null

    if (!title || !content) {
      return createErrorResponse("内容包含不安全字符", "UNSAFE_CONTENT", 400)
    }

    // 生成 slug（如果未提供）
    if (!slug) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 100)
    }

    // 检查 slug 唯一性
    const existingPost = await prisma.post.findUnique({
      where: { slug },
    })

    if (existingPost) {
      slug = `${slug}-${Date.now()}`
    }

    // 准备标签数据
    const tagConnections = tags
      ? {
          create: tags.map((tagName: string) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: {
                  name: tagName,
                  slug: tagName.toLowerCase().replace(/\s+/g, "-"),
                },
              },
            },
          })),
        }
      : undefined

    // 创建文章
    const post = await prisma.post.create({
      data: {
        title,
        content,
        excerpt: excerpt || content.substring(0, 200),
        slug,
        published: published !== undefined ? published : false,
        authorId: admin.id,
        seriesId: seriesId || null,
        seoTitle: seoTitle || title,
        seoDescription: seoDescription || excerpt || content.substring(0, 160),
        ...(tagConnections && { tags: tagConnections }),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        series: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    return createSuccessResponse(post, admin)
  } catch (error) {
    console.error("创建文章失败:", error)
    return createErrorResponse("创建文章失败", "CREATE_POST_FAILED", 500)
  }
}

/**
 * 更新文章状态（发布/撤回）
 */
async function updatePostStatusHandler(request: NextRequest, admin: User) {
  try {
    const body = await request.json()
    const { postId, published } = body

    // 验证输入
    if (!postId || published === undefined || typeof published !== "boolean") {
      return createErrorResponse("参数错误：文章ID和发布状态是必需的", "INVALID_PARAMETERS", 400)
    }

    // 检查文章是否存在
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, title: true, published: true, authorId: true },
    })

    if (!existingPost) {
      return createErrorResponse("文章不存在", "POST_NOT_FOUND", 404)
    }

    // 更新文章状态
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        published,
        publishedAt: published ? new Date() : null,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            name: true,
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

    return createSuccessResponse(
      {
        post: updatedPost,
        action: published ? "published" : "unpublished",
      },
      admin
    )
  } catch (error) {
    console.error("更新文章状态失败:", error)
    return createErrorResponse("更新文章状态失败", "UPDATE_POST_STATUS_FAILED", 500)
  }
}

/**
 * 删除文章
 */
async function deletePostHandler(request: NextRequest, admin: User) {
  try {
    const { searchParams } = request.nextUrl
    const postId = searchParams.get("id")

    if (!postId) {
      return createErrorResponse("文章ID是必需的", "MISSING_POST_ID", 400)
    }

    // 检查文章是否存在
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        title: true,
        authorId: true,
        _count: {
          select: {
            comments: true,
            likes: true,
            bookmarks: true,
          },
        },
      },
    })

    if (!existingPost) {
      return createErrorResponse("文章不存在", "POST_NOT_FOUND", 404)
    }

    // 删除文章（会级联删除相关的标签关联、评论、点赞等）
    await prisma.post.delete({
      where: { id: postId },
    })

    return createSuccessResponse(
      {
        deletedPost: {
          id: existingPost.id,
          title: existingPost.title,
        },
        affectedRecords: existingPost._count,
      },
      admin
    )
  } catch (error) {
    console.error("删除文章失败:", error)
    return createErrorResponse("删除文章失败", "DELETE_POST_FAILED", 500)
  }
}

// 导出 HTTP 方法处理器
export const GET = withApiAuth(getPostsHandler, "admin")
export const POST = withApiAuth(createPostHandler, "admin")
export const PUT = withApiAuth(updatePostStatusHandler, "admin")
export const DELETE = withApiAuth(deletePostHandler, "admin")

// 处理 CORS 预检请求
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
      "Access-Control-Allow-Credentials": "true",
    },
  })
}
