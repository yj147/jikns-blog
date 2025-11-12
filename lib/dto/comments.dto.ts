/**
 * 评论系统 DTO 定义
 * 使用 Zod 定义共享的数据传输对象，前后端共用
 */

import { z } from "zod"

// ==================== ID 校验器 ====================

/**
 * CUID 校验器
 * CUID 格式：以 'c' 开头，长度 25 个字符，包含小写字母和数字
 * 例如：cmfle0d6m0007jxub2lat5s9b
 */
const cuidRegex = /^c[a-z0-9]{24}$/
export const cuidSchema = z.string().regex(cuidRegex, "无效的ID格式")

/**
 * 兼容 UUID 和 CUID 的 ID 校验器
 * 支持两种格式以便向后兼容
 */
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const flexibleIdSchema = z
  .string()
  .refine((val) => cuidRegex.test(val) || uuidRegex.test(val), {
    message: "无效的ID格式（需要CUID或UUID）",
  })

// ==================== 枚举定义 ====================

/**
 * 评论目标类型
 */
export const CommentTargetTypeEnum = z.enum(["post", "activity"])
export type CommentTargetType = z.infer<typeof CommentTargetTypeEnum>

// ==================== 基础 Schema ====================

/**
 * 评论作者信息
 */
export const CommentAuthorSchema = z.object({
  id: flexibleIdSchema,
  name: z.string().min(1).nullable(),
  email: z.string().email(),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(["USER", "ADMIN"]),
})

/**
 * 评论基础信息
 */
export const CommentBaseSchema = z.object({
  id: flexibleIdSchema,
  content: z.string().min(1).max(1000),
  targetType: CommentTargetTypeEnum,
  targetId: flexibleIdSchema,
  parentId: flexibleIdSchema.nullable(),
  authorId: flexibleIdSchema,
  postId: flexibleIdSchema.nullable(),
  activityId: flexibleIdSchema.nullable(),
  isDeleted: z.boolean().default(false),
  deletedAt: z.union([z.date(), z.string().datetime()]).nullable(),
  createdAt: z.union([z.date(), z.string().datetime()]),
  updatedAt: z.union([z.date(), z.string().datetime()]),
})

// ==================== 请求 DTO ====================

/**
 * 创建评论请求
 */
export const CreateCommentDto = z.object({
  content: z.string().min(1, "评论内容不能为空").max(1000, "评论内容不能超过1000字"),
  targetType: CommentTargetTypeEnum,
  targetId: flexibleIdSchema,
  parentId: flexibleIdSchema.nullable().optional(),
})

export type CreateCommentInput = z.infer<typeof CreateCommentDto>

/**
 * 更新评论请求
 */
export const UpdateCommentDto = z.object({
  content: z.string().min(1, "评论内容不能为空").max(1000, "评论内容不能超过1000字"),
})

export type UpdateCommentInput = z.infer<typeof UpdateCommentDto>

/**
 * 查询评论列表参数
 */
export const ListCommentsDto = z.object({
  targetType: CommentTargetTypeEnum,
  targetId: flexibleIdSchema,
  parentId: flexibleIdSchema.nullable().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

export type ListCommentsInput = z.infer<typeof ListCommentsDto>

// ==================== 响应 DTO ====================

/**
 * 单个评论响应（包含作者信息和权限）
 */
const CommentRepliesCountSchema = z.object({
  replies: z.number().int().min(0).default(0),
})

const CommentResponseDtoInternal: z.ZodTypeAny = CommentBaseSchema.extend({
  author: CommentAuthorSchema.nullable().optional(),
  canEdit: z.boolean().optional(),
  canDelete: z.boolean().optional(),
  _count: CommentRepliesCountSchema.optional(),
  childrenCount: z.number().int().min(0).default(0),
  replies: z.lazy((): z.ZodArray<z.ZodTypeAny> => CommentResponseDtoInternal.array()).optional(),
})

export const CommentResponseDto = CommentResponseDtoInternal
export type CommentResponse = z.infer<typeof CommentResponseDto>

/**
 * 评论列表响应
 *
 * 注意：PaginationMetaSchema 与 @/lib/api/unified-response 的 PaginationMeta 保持一致
 * page 字段改为可选，以支持 cursor 分页
 */
const PaginationMetaSchema = z.object({
  page: z.number().int().optional(),
  limit: z.number().int(),
  total: z.number().int(),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable().optional(),
})

export const CommentListResponseDto = z.object({
  success: z.literal(true),
  data: z.array(CommentResponseDto),
  meta: z
    .object({
      timestamp: z.string().datetime().optional(),
      pagination: PaginationMetaSchema.optional(),
    })
    .optional(),
})

export type CommentListResponse = z.infer<typeof CommentListResponseDto>

/**
 * 评论删除响应
 */
export const DeleteCommentResponseDto = z.object({
  deletedAt: z.string().datetime(),
  affectedCount: z.number().int().optional(),
})

export type DeleteCommentResponse = z.infer<typeof DeleteCommentResponseDto>

// ==================== 工具函数 ====================

/**
 * 验证创建评论数据
 */
export function validateCreateComment(data: unknown): CreateCommentInput {
  return CreateCommentDto.parse(data)
}

/**
 * 验证更新评论数据
 */
export function validateUpdateComment(data: unknown): UpdateCommentInput {
  return UpdateCommentDto.parse(data)
}

/**
 * 验证查询参数
 */
export function validateListComments(data: unknown): ListCommentsInput {
  return ListCommentsDto.parse(data)
}

/**
 * 安全解析创建评论数据
 */
export function safeParseCreateComment(data: unknown) {
  return CreateCommentDto.safeParse(data)
}

/**
 * 安全解析更新评论数据
 */
export function safeParseUpdateComment(data: unknown) {
  return UpdateCommentDto.safeParse(data)
}

/**
 * 安全解析查询参数
 */
export function safeParseListComments(data: unknown) {
  return ListCommentsDto.safeParse(data)
}
