/**
 * 文章相关 Server Actions
 * 演示 Server Actions 权限保护的实现
 */

"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"
import { randomUUID } from "node:crypto"
import {
  createPost as createPostAction,
  updatePost as updatePostAction,
  deletePost as deletePostAction,
} from "@/lib/actions/posts"

type UpdatePostRequest = Parameters<typeof updatePostAction>[0]

/**
 * 创建新文章（管理员专用）
 */
export async function createPost(formData: FormData) {
  try {
    const title = formData.get("title")?.toString() ?? ""
    const content = formData.get("content")?.toString() ?? ""
    const excerpt = formData.get("excerpt")?.toString()
    const canonicalUrl = formData.get("canonicalUrl")?.toString()
    const seoTitle = formData.get("seoTitle")?.toString()
    const seoDescription = formData.get("seoDescription")?.toString()
    const coverImage = formData.get("coverImage")?.toString()
    const seriesId = formData.get("seriesId")?.toString()
    const published = formData.get("published") === "true"

    const rawTags = formData.get("tags")
    const tagNames =
      rawTags !== null
        ? rawTags
            .toString()
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined

    const result = await createPostAction({
      title,
      content,
      excerpt: excerpt?.trim() || undefined,
      published,
      canonicalUrl: canonicalUrl?.trim() || undefined,
      seoTitle: seoTitle?.trim() || undefined,
      seoDescription: seoDescription?.trim() || undefined,
      coverImage: coverImage?.trim() || undefined,
      seriesId: seriesId?.trim() || undefined,
      ...(tagNames !== undefined ? { tagNames } : {}),
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error?.message ?? "创建文章失败",
      }
    }

    let finalSlug = result.data.slug
    const manualSlug = formData.get("slug")?.toString()?.trim()
    if (manualSlug && manualSlug !== result.data.slug) {
      const updateResult = await updatePostAction({
        id: result.data.id,
        slug: manualSlug,
      })

      if (!updateResult.success || !updateResult.data) {
        return {
          success: false,
          error: updateResult.error?.message ?? "创建文章失败",
        }
      }

      finalSlug = updateResult.data.slug
    }

    return {
      success: true,
      data: { postId: result.data.id, slug: finalSlug },
      message: result.data.published ? "文章发布成功" : "文章草稿保存成功",
    }
  } catch (error) {
    logger.error(
      "创建文章失败",
      { module: "app/actions/post-actions", action: "createPost" },
      error
    )
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
    const updatePayload: UpdatePostRequest = { id: postId }

    const title = formData.get("title")
    if (title !== null) {
      updatePayload.title = title.toString()
    }

    const content = formData.get("content")
    if (content !== null) {
      updatePayload.content = content.toString()
    }

    const excerpt = formData.get("excerpt")
    if (excerpt !== null) {
      updatePayload.excerpt = excerpt.toString()
    }

    const slug = formData.get("slug")
    if (slug !== null) {
      updatePayload.slug = slug.toString()
    }

    const canonicalUrl = formData.get("canonicalUrl")
    if (canonicalUrl !== null) {
      updatePayload.canonicalUrl = canonicalUrl.toString()
    }

    const seoTitle = formData.get("seoTitle")
    if (seoTitle !== null) {
      updatePayload.seoTitle = seoTitle.toString()
    }

    const seoDescription = formData.get("seoDescription")
    if (seoDescription !== null) {
      updatePayload.seoDescription = seoDescription.toString()
    }

    const coverImage = formData.get("coverImage")
    if (coverImage !== null) {
      updatePayload.coverImage = coverImage.toString()
    }

    const seriesId = formData.get("seriesId")
    if (seriesId !== null) {
      updatePayload.seriesId = seriesId.toString()
    }

    if (formData.has("published")) {
      updatePayload.published = formData.get("published") === "true"
    }

    const rawTags = formData.get("tags")
    if (rawTags !== null) {
      updatePayload.tagNames = rawTags
        .toString()
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    }

    const result = await updatePostAction(updatePayload)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error?.message ?? "更新文章失败",
      }
    }

    return {
      success: true,
      data: { postId: result.data.id, slug: result.data.slug },
      message: "文章更新成功",
    }
  } catch (error) {
    logger.error(
      "更新文章失败",
      { module: "app/actions/post-actions", action: "updatePost", postId },
      error
    )
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
    const result = await deletePostAction(postId)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error?.message ?? "删除文章失败",
      }
    }

    return {
      success: true,
      message: result.data.message ?? "文章删除成功",
    }
  } catch (error) {
    logger.error(
      "删除文章失败",
      { module: "app/actions/post-actions", action: "deletePost" },
      error
    )
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
        id: randomUUID(),
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
    logger.error(
      "收藏文章失败",
      { module: "app/actions/post-actions", action: "bookmarkPost" },
      error
    )
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
    logger.error(
      "取消收藏失败",
      { module: "app/actions/post-actions", action: "removeBookmark" },
      error
    )
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
          id: randomUUID(),
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
    logger.error(
      "点赞操作失败",
      { module: "app/actions/post-actions", action: "toggleLike", postId },
      error
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : "点赞操作失败",
    }
  }
}
