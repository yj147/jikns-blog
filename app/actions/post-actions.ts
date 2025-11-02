/**
 * 文章相关 Server Actions
 * 演示 Server Actions 权限保护的实现
 */

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { requireAuth, requireAdmin } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

/**
 * 创建新文章（管理员专用）
 */
export async function createPost(formData: FormData) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin()

    // 提取表单数据
    const title = formData.get("title")?.toString()
    const content = formData.get("content")?.toString()
    const excerpt = formData.get("excerpt")?.toString()
    const slug = formData.get("slug")?.toString()
    const published = formData.get("published") === "true"
    const seriesId = formData.get("seriesId")?.toString()
    const tags = formData.get("tags")?.toString()

    // 输入验证
    if (!title || title.trim().length < 3) {
      throw new Error("文章标题至少需要3个字符")
    }

    if (!content || content.trim().length < 10) {
      throw new Error("文章内容至少需要10个字符")
    }

    if (!slug || slug.trim().length < 3) {
      throw new Error("文章URL至少需要3个字符")
    }

    // 验证slug格式（只允许字母、数字、连字符）
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      throw new Error("URL只能包含小写字母、数字和连字符")
    }

    // 检查slug是否已存在
    const existingPost = await prisma.post.findUnique({
      where: { slug: slug.trim() },
    })

    if (existingPost) {
      throw new Error("此URL已被使用，请选择其他URL")
    }

    // 创建文章
    const post = await prisma.post.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        excerpt: excerpt?.trim() || null,
        slug: slug.trim(),
        published,
        publishedAt: published ? new Date() : null,
        authorId: admin.id,
        seriesId: seriesId || null,
      },
    })

    // 处理标签
    if (tags) {
      const tagNames = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)

      for (const tagName of tagNames) {
        // 创建或获取标签
        const tag = await prisma.tag.upsert({
          where: { slug: tagName.toLowerCase().replace(/\s+/g, "-") },
          update: {
            postsCount: {
              increment: 1,
            },
          },
          create: {
            name: tagName,
            slug: tagName.toLowerCase().replace(/\s+/g, "-"),
            postsCount: 1,
          },
        })

        // 关联文章和标签
        await prisma.postTag.create({
          data: {
            postId: post.id,
            tagId: tag.id,
          },
        })
      }
    }

    // 重新验证相关页面
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    if (published) {
      revalidatePath(`/blog/${post.slug}`)
    }

    return {
      success: true,
      data: { postId: post.id, slug: post.slug },
      message: published ? "文章发布成功" : "文章草稿保存成功",
    }
  } catch (error) {
    console.error("创建文章失败:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "创建文章失败",
    }
  }
}

/**
 * 更新文章（管理员专用）
 */
export async function updatePost(postId: string, formData: FormData) {
  try {
    // 验证管理员权限
    await requireAdmin()

    // 验证文章存在
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
    })

    if (!existingPost) {
      throw new Error("文章不存在")
    }

    // 提取表单数据
    const title = formData.get("title")?.toString()
    const content = formData.get("content")?.toString()
    const excerpt = formData.get("excerpt")?.toString()
    const published = formData.get("published") === "true"
    const isPinned = formData.get("isPinned") === "true"

    // 输入验证
    if (!title || title.trim().length < 3) {
      throw new Error("文章标题至少需要3个字符")
    }

    if (!content || content.trim().length < 10) {
      throw new Error("文章内容至少需要10个字符")
    }

    // 更新数据
    const updateData: any = {
      title: title.trim(),
      content: content.trim(),
      excerpt: excerpt?.trim() || null,
      published,
      isPinned,
    }

    // 如果发布状态改变，更新发布时间
    if (published && !existingPost.published) {
      updateData.publishedAt = new Date()
    } else if (!published && existingPost.published) {
      updateData.publishedAt = null
    }

    // 执行更新
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: updateData,
    })

    // 重新验证相关页面
    revalidatePath("/admin/posts")
    revalidatePath("/blog")
    revalidatePath(`/blog/${updatedPost.slug}`)

    return {
      success: true,
      data: { postId: updatedPost.id, slug: updatedPost.slug },
      message: "文章更新成功",
    }
  } catch (error) {
    console.error("更新文章失败:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "更新文章失败",
    }
  }
}

/**
 * 删除文章（管理员专用）
 */
export async function deletePost(postId: string) {
  try {
    // 验证管理员权限
    await requireAdmin()

    // 验证文章存在
    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (!existingPost) {
      throw new Error("文章不存在")
    }

    // 删除文章（级联删除相关数据）
    await prisma.post.delete({
      where: { id: postId },
    })

    // 更新标签使用计数
    for (const postTag of existingPost.tags) {
      await prisma.tag.update({
        where: { id: postTag.tag.id },
        data: {
          postsCount: {
            decrement: 1,
          },
        },
      })
    }

    // 重新验证相关页面
    revalidatePath("/admin/posts")
    revalidatePath("/blog")

    return {
      success: true,
      message: "文章删除成功",
    }
  } catch (error) {
    console.error("删除文章失败:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "删除文章失败",
    }
  }
}

/**
 * 收藏文章（需要认证）
 */
export async function bookmarkPost(postId: string) {
  try {
    // 验证用户认证
    const user = await requireAuth()

    // 验证文章存在且已发布
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        published: true,
      },
    })

    if (!post) {
      throw new Error("文章不存在或未发布")
    }

    // 检查是否已收藏
    const existingBookmark = await prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId: user.id,
          postId: postId,
        },
      },
    })

    if (existingBookmark) {
      throw new Error("您已经收藏过这篇文章")
    }

    // 创建收藏记录
    await prisma.bookmark.create({
      data: {
        userId: user.id,
        postId: postId,
      },
    })

    // 重新验证相关页面
    revalidatePath("/profile/bookmarks")
    revalidatePath(`/blog/${post.slug}`)

    return {
      success: true,
      message: "收藏成功",
    }
  } catch (error) {
    console.error("收藏文章失败:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "收藏失败",
    }
  }
}

/**
 * 取消收藏文章（需要认证）
 */
export async function unbookmarkPost(postId: string) {
  try {
    // 验证用户认证
    const user = await requireAuth()

    // 查找并删除收藏记录
    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_postId: {
          userId: user.id,
          postId: postId,
        },
      },
    })

    if (!bookmark) {
      throw new Error("您尚未收藏这篇文章")
    }

    await prisma.bookmark.delete({
      where: {
        userId_postId: {
          userId: user.id,
          postId: postId,
        },
      },
    })

    // 获取文章信息用于重新验证
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { slug: true },
    })

    // 重新验证相关页面
    revalidatePath("/profile/bookmarks")
    if (post) {
      revalidatePath(`/blog/${post.slug}`)
    }

    return {
      success: true,
      message: "取消收藏成功",
    }
  } catch (error) {
    console.error("取消收藏失败:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "取消收藏失败",
    }
  }
}

/**
 * 点赞文章（需要认证）
 */
export async function likePost(postId: string) {
  try {
    // 验证用户认证
    const user = await requireAuth()

    // 验证文章存在且已发布
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        published: true,
      },
    })

    if (!post) {
      throw new Error("文章不存在或未发布")
    }

    // 检查是否已点赞
    const existingLike = await prisma.like.findUnique({
      where: {
        authorId_postId: {
          authorId: user.id,
          postId: postId,
        },
      },
    })

    if (existingLike) {
      // 如果已点赞，则取消点赞
      await prisma.like.delete({
        where: {
          authorId_postId: {
            authorId: user.id,
            postId: postId,
          },
        },
      })

      return {
        success: true,
        data: { liked: false },
        message: "取消点赞成功",
      }
    } else {
      // 创建点赞记录
      await prisma.like.create({
        data: {
          authorId: user.id,
          postId: postId,
        },
      })

      return {
        success: true,
        data: { liked: true },
        message: "点赞成功",
      }
    }
  } catch (error) {
    console.error("点赞操作失败:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "点赞操作失败",
    }
  }
}
