"use server"

import { z } from "zod"

import type { ApiResponse as UnifiedApiResponse } from "@/lib/api/unified-response"
import { Prisma } from "@/lib/generated/prisma"
import { prisma } from "@/lib/prisma"
import { normalizeTagSlug } from "@/lib/utils/tag"
import { logger } from "@/lib/utils/logger"
import { TagNameSchema } from "@/lib/validation/tag"
import { AuditEventType, auditLogger } from "@/lib/audit-log"
import { getServerContext } from "@/lib/server-context"

import type { TagData } from "./queries"
import { createSuccessResponse, createErrorResponse } from "./response-helpers"
import { revalidateTagCaches, revalidateTagDetail } from "./cache-helpers"
import { enforceTagMutationGuards, handleTagMutationError } from "./shared"

type ApiResponse<T = any> = UnifiedApiResponse<T>

const CreateTagSchema = z.object({
  name: TagNameSchema,
  description: z.string().trim().max(200, "标签描述不能超过200个字符").optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "颜色格式无效")
    .optional(),
})

export type CreateTagData = z.infer<typeof CreateTagSchema>

const UpdateTagSchema = z.object({
  name: TagNameSchema.optional(),
  description: z.string().trim().max(200).optional().nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
})

export type UpdateTagData = z.infer<typeof UpdateTagSchema>

type TagAuditAction = "TAG_CREATE" | "TAG_UPDATE" | "TAG_DELETE"

async function recordTagAudit(params: {
  action: TagAuditAction
  success: boolean
  adminId?: string
  tagId?: string
  slug?: string
  errorCode?: string
  errorMessage?: string
}) {
  const context = getServerContext()
  const details = {
    ...(params.tagId ? { tagId: params.tagId } : {}),
    ...(params.slug ? { slug: params.slug } : {}),
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
  }

  await auditLogger.logEvent({
    eventType: AuditEventType.ADMIN_ACTION,
    action: params.action,
    resource: params.tagId ?? params.slug,
    userId: params.adminId,
    success: params.success,
    details: Object.keys(details).length > 0 ? details : undefined,
    errorMessage: params.errorMessage,
    severity: params.success ? "LOW" : "MEDIUM",
    requestId: context.requestId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  })
}

/**
 * 检查标签名称或 slug 是否重复
 */
async function ensureTagUnique(
  name: string,
  slug: string,
  excludeId?: string
): Promise<ApiResponse | null> {
  const where = excludeId
    ? { AND: [{ id: { not: excludeId } }, { OR: [{ name }, { slug }] }] }
    : { OR: [{ name }, { slug }] }

  const existingTag = await prisma.tag.findFirst({ where })

  if (existingTag) {
    const message = existingTag.name === name ? "标签名称已存在" : "标签标识已存在"
    return createErrorResponse("DUPLICATE_ENTRY", message)
  }

  return null
}

/**
 * 创建新的正式标签，包含唯一性校验、审计日志与缓存失效。
 * @param data - 标签名称、描述、颜色等字段
 * @returns 带有标签数据的统一响应
 */
export async function createTag(data: CreateTagData): Promise<ApiResponse<{ tag: TagData }>> {
  "use server"
  let adminId: string | undefined
  let pendingSlug: string | undefined

  try {
    const admin = await enforceTagMutationGuards()
    adminId = admin.id

    const { name, description, color } = CreateTagSchema.parse(data)
    pendingSlug = normalizeTagSlug(name)

    if (!pendingSlug) {
      const response = createErrorResponse("VALIDATION_ERROR", "无法生成有效的标签标识")
      await recordTagAudit({
        action: "TAG_CREATE",
        adminId,
        slug: pendingSlug,
        success: false,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    const duplicateError = await ensureTagUnique(name, pendingSlug)
    if (duplicateError) {
      await recordTagAudit({
        action: "TAG_CREATE",
        adminId,
        slug: pendingSlug,
        success: false,
        errorCode: duplicateError.error?.code,
        errorMessage: duplicateError.error?.message,
      })
      return duplicateError
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        slug: pendingSlug,
        description: description || null,
        color: color || null,
        postsCount: 0,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        postsCount: true,
        createdAt: true,
      },
    })

    logger.info(`标签已创建: ${tag.name} (${tag.id})`)
    revalidateTagCaches()

    await recordTagAudit({
      action: "TAG_CREATE",
      adminId,
      tagId: tag.id,
      slug: tag.slug,
      success: true,
    })

    return createSuccessResponse({ tag })
  } catch (error) {
    let response: ApiResponse
    if (error instanceof z.ZodError) {
      response = createErrorResponse("VALIDATION_ERROR", "参数验证失败", error.errors)
    } else {
      response = handleTagMutationError(error, "创建标签")
    }

    await recordTagAudit({
      action: "TAG_CREATE",
      adminId,
      slug: pendingSlug,
      success: false,
      errorCode: response.error?.code,
      errorMessage:
        response.error?.message || (error instanceof Error ? error.message : "创建标签失败"),
    })

    return response
  }
}

/**
 * 更新指定标签的名称、描述或颜色，并同步缓存与审计日志。
 * @param tagId - 需要更新的标签 ID
 * @param data - 可选的标签更新字段
 * @returns 更新后的标签信息
 */
export async function updateTag(
  tagId: string,
  data: UpdateTagData
): Promise<ApiResponse<{ tag: TagData }>> {
  "use server"
  let adminId: string | undefined
  let latestSlug: string | undefined

  try {
    const admin = await enforceTagMutationGuards()
    adminId = admin.id

    if (!tagId) {
      const response = createErrorResponse("VALIDATION_ERROR", "标签ID不能为空")
      await recordTagAudit({
        action: "TAG_UPDATE",
        adminId,
        tagId,
        slug: latestSlug,
        success: false,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    const validatedData = UpdateTagSchema.parse(data)
    if (Object.keys(validatedData).length === 0) {
      const response = createErrorResponse("VALIDATION_ERROR", "至少需要提供一个更新字段")
      await recordTagAudit({
        action: "TAG_UPDATE",
        adminId,
        tagId,
        slug: latestSlug,
        success: false,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    const existingTag = await prisma.tag.findUnique({ where: { id: tagId } })
    if (!existingTag) {
      const response = createErrorResponse("NOT_FOUND", "标签不存在")
      await recordTagAudit({
        action: "TAG_UPDATE",
        adminId,
        tagId,
        success: false,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    latestSlug = existingTag.slug
    let slug = existingTag.slug
    if (validatedData.name && validatedData.name !== existingTag.name) {
      slug = normalizeTagSlug(validatedData.name)
      if (!slug) {
        const response = createErrorResponse("VALIDATION_ERROR", "无法生成有效的标签标识")
        await recordTagAudit({
          action: "TAG_UPDATE",
          adminId,
          tagId,
          slug: latestSlug,
          success: false,
          errorCode: response.error?.code,
          errorMessage: response.error?.message,
        })
        return response
      }

      const duplicateError = await ensureTagUnique(validatedData.name, slug, tagId)
      if (duplicateError) {
        await recordTagAudit({
          action: "TAG_UPDATE",
          adminId,
          tagId,
          slug,
          success: false,
          errorCode: duplicateError.error?.code,
          errorMessage: duplicateError.error?.message,
        })
        return duplicateError
      }
    }

    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...validatedData,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        postsCount: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    logger.info(`标签已更新: ${tag.name} (${tag.id})`)

    revalidateTagCaches()
    if (slug !== existingTag.slug) {
      revalidateTagDetail(existingTag.slug)
    }
    revalidateTagDetail(tag.slug)

    await recordTagAudit({
      action: "TAG_UPDATE",
      adminId,
      tagId: tag.id,
      slug: tag.slug,
      success: true,
    })

    return createSuccessResponse({ tag })
  } catch (error) {
    let response: ApiResponse
    if (error instanceof z.ZodError) {
      response = createErrorResponse("VALIDATION_ERROR", "参数验证失败", error.errors)
    } else {
      response = handleTagMutationError(error, "更新标签")
    }

    await recordTagAudit({
      action: "TAG_UPDATE",
      adminId,
      tagId,
      slug: latestSlug,
      success: false,
      errorCode: response.error?.code,
      errorMessage:
        response.error?.message || (error instanceof Error ? error.message : "更新标签失败"),
    })

    return response
  }
}

/**
 * 删除指定标签并同步缓存与审计日志。
 * @param tagId - 待删除的标签 ID
 * @returns 包含提示消息的统一响应
 */
export async function deleteTag(tagId: string): Promise<ApiResponse<{ message: string }>> {
  "use server"
  let adminId: string | undefined
  let slugForAudit: string | undefined

  try {
    const admin = await enforceTagMutationGuards()
    adminId = admin.id

    if (!tagId) {
      const response = createErrorResponse("VALIDATION_ERROR", "标签ID不能为空")
      await recordTagAudit({
        action: "TAG_DELETE",
        adminId,
        tagId,
        success: false,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    const existingTag = await prisma.tag.findUnique({
      where: { id: tagId },
      select: { id: true, name: true, slug: true },
    })

    if (!existingTag) {
      const response = createErrorResponse("NOT_FOUND", "标签不存在")
      await recordTagAudit({
        action: "TAG_DELETE",
        adminId,
        tagId,
        success: false,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    slugForAudit = existingTag.slug

    await prisma.tag.delete({ where: { id: tagId } })

    logger.info(`标签已删除: ${existingTag.name} (${existingTag.id})`)

    revalidateTagCaches()
    revalidateTagDetail(existingTag.slug)

    await recordTagAudit({
      action: "TAG_DELETE",
      adminId,
      tagId: existingTag.id,
      slug: existingTag.slug,
      success: true,
    })

    return createSuccessResponse({
      message: `标签 "${existingTag.name}" 已成功删除`,
    })
  } catch (error) {
    const response = handleTagMutationError(error, "删除标签")

    await recordTagAudit({
      action: "TAG_DELETE",
      adminId,
      tagId,
      slug: slugForAudit,
      success: false,
      errorCode: response.error?.code,
      errorMessage:
        response.error?.message || (error instanceof Error ? error.message : "删除标签失败"),
    })

    return response
  }
}
