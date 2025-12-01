"use server"

import { z } from "zod"

import type { ApiResponse as UnifiedApiResponse, PaginationMeta } from "@/lib/api/unified-response"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/utils/logger"
import { sanitizeTagName } from "@/lib/validation/tag"
import { requireAdmin } from "@/lib/permissions"
import { AuditEventType, auditLogger } from "@/lib/audit-log"
import { getServerContext } from "@/lib/server-context"

import type { TagData } from "./queries"
import { createSuccessResponse, createErrorResponse } from "./response-helpers"
import { revalidateTagCaches, revalidateTagDetail } from "./cache-helpers"
import {
  enforceTagMutationGuards,
  handleTagMutationError,
  mapTagAuthError,
  mapTagRateLimitError,
} from "./shared"

type ApiResponse<T = any> = UnifiedApiResponse<T>

async function recordCandidatePromotionAudit(params: {
  success: boolean
  adminId?: string
  candidateId?: string
  tagId?: string
  slug?: string
  errorCode?: string
  errorMessage?: string
}) {
  const context = await getServerContext()
  const details = {
    ...(params.candidateId ? { candidateId: params.candidateId } : {}),
    ...(params.tagId ? { tagId: params.tagId } : {}),
    ...(params.slug ? { slug: params.slug } : {}),
    ...(params.errorCode ? { errorCode: params.errorCode } : {}),
  }

  await auditLogger.logEvent({
    eventType: AuditEventType.ADMIN_ACTION,
    action: "TAG_PROMOTE",
    resource: params.tagId ?? params.slug ?? params.candidateId,
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
const GetTagCandidatesSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
  orderBy: z.enum(["occurrences", "lastSeenAt", "createdAt"]).default("occurrences"),
  order: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().optional(),
})

export type GetTagCandidatesOptions = z.infer<typeof GetTagCandidatesSchema>

export interface TagCandidateData {
  id: string
  name: string
  slug: string
  occurrences: number
  createdAt: Date
  updatedAt: Date
  lastSeenAt: Date
  lastSeenActivityId: string | null
}

export interface TagCandidateListPagination extends PaginationMeta {
  totalPages: number
}

interface NormalizedSearchResult {
  keyword?: string
  invalid: boolean
}

function normalizeSearchKeyword(value?: string | null): NormalizedSearchResult {
  if (!value) {
    return { keyword: undefined, invalid: false }
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return { keyword: undefined, invalid: false }
  }

  const withoutPrefix = trimmed.replace(/^#+/, "")
  if (!withoutPrefix) {
    return { keyword: undefined, invalid: true }
  }

  const sanitized = sanitizeTagName(withoutPrefix)
  if (!sanitized) {
    return { keyword: undefined, invalid: true }
  }

  return { keyword: sanitized, invalid: false }
}

/**
 * 获取 hashtag 候选列表，支持分页、排序与关键字搜索。
 * @param options - 分页、排序及搜索条件
 */
export async function getTagCandidates(
  options: Partial<GetTagCandidatesOptions> = {}
): Promise<
  ApiResponse<{ candidates: TagCandidateData[]; pagination: TagCandidateListPagination }>
> {
  "use server"
  try {
    await requireAdmin()
  } catch (error) {
    const authError = mapTagAuthError(error)
    if (authError) return authError
    throw error
  }

  try {
    const validatedOptions = GetTagCandidatesSchema.parse(options)
    const { page, limit, orderBy, order, search } = validatedOptions
    const { keyword, invalid } = normalizeSearchKeyword(search)

    if (invalid) {
      return createErrorResponse(
        "VALIDATION_ERROR",
        "搜索关键词仅支持字母、数字、中文以及 .-_ 字符",
        {
          input: search?.trim(),
        }
      )
    }

    const where = keyword
      ? {
          OR: [
            { name: { contains: keyword, mode: "insensitive" as const } },
            { slug: { contains: keyword, mode: "insensitive" as const } },
          ],
        }
      : {}

    const [total, records] = await Promise.all([
      prisma.activityTagCandidate.count({ where }),
      prisma.activityTagCandidate.findMany({
        where,
        orderBy: { [orderBy]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit)
    const paginationMeta: PaginationMeta = {
      page,
      limit,
      total,
      hasMore: page < totalPages,
    }

    return createSuccessResponse(
      { candidates: records, pagination: { ...paginationMeta, totalPages } },
      paginationMeta
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse("VALIDATION_ERROR", "参数验证失败", error.errors)
    }
    logger.error("获取候选标签失败:", error as Error)
    return createErrorResponse("INTERNAL_ERROR", "获取候选标签失败")
  }
}

/**
 * 将候选标签提升为正式标签，同时执行权限校验、限流与审计记录。
 * @param candidateId - 候选标签 ID
 */
export async function promoteTagCandidate(
  candidateId: string
): Promise<ApiResponse<{ tag: TagData }>> {
  "use server"
  let adminId: string | undefined
  let latestCandidate: TagCandidateData | null = null

  try {
    const admin = await enforceTagMutationGuards()
    adminId = admin.id

    if (!candidateId) {
      const response = createErrorResponse("VALIDATION_ERROR", "候选标签ID不能为空")
      await recordCandidatePromotionAudit({
        success: false,
        adminId,
        candidateId,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    const candidate = await prisma.activityTagCandidate.findUnique({
      where: { id: candidateId },
    })

    if (!candidate) {
      const response = createErrorResponse("NOT_FOUND", "候选标签不存在或已处理")
      await recordCandidatePromotionAudit({
        success: false,
        adminId,
        candidateId,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    latestCandidate = candidate

    const duplicate = await prisma.tag.findFirst({
      where: {
        OR: [{ slug: candidate.slug }, { name: candidate.name }],
      },
      select: { id: true },
    })

    if (duplicate) {
      const response = createErrorResponse("DUPLICATE_ENTRY", "同名或同标识的标签已存在")
      await recordCandidatePromotionAudit({
        success: false,
        adminId,
        candidateId: candidate.id,
        slug: candidate.slug,
        errorCode: response.error?.code,
        errorMessage: response.error?.message,
      })
      return response
    }

    const [tag] = await prisma.$transaction([
      prisma.tag.create({
        data: {
          name: candidate.name,
          slug: candidate.slug,
          description: null,
          color: null,
          postsCount: 0,
          activitiesCount: 0,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          color: true,
          postsCount: true,
          activitiesCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.activityTagCandidate.delete({ where: { id: candidateId } }),
    ])

    revalidateTagCaches()
    revalidateTagDetail(tag.slug)

    logger.info(`候选标签已提升为正式标签: ${tag.name} (${tag.id})`)

    await recordCandidatePromotionAudit({
      success: true,
      adminId,
      candidateId: candidate.id,
      tagId: tag.id,
      slug: tag.slug,
    })

    return createSuccessResponse({ tag })
  } catch (error) {
    const rateLimitError = mapTagRateLimitError(error)
    if (rateLimitError) {
      await recordCandidatePromotionAudit({
        success: false,
        adminId,
        candidateId: latestCandidate?.id ?? candidateId,
        slug: latestCandidate?.slug,
        errorCode: rateLimitError.error?.code,
        errorMessage: rateLimitError.error?.message,
      })
      return rateLimitError
    }
    const response = handleTagMutationError(error, "提升候选标签", {
      notFoundMessage: "候选标签不存在或已处理",
    })
    await recordCandidatePromotionAudit({
      success: false,
      adminId,
      candidateId: latestCandidate?.id ?? candidateId,
      slug: latestCandidate?.slug,
      errorCode: response.error?.code,
      errorMessage: response.error?.message || (error instanceof Error ? error.message : undefined),
    })
    return response
  }
}
