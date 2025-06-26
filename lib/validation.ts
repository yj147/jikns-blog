import { z } from 'zod'

// ===== 基础验证规则 =====

// 通用字段验证
export const baseValidation = {
  // 文章标识
  postSlug: z.string().min(1, '文章标识不能为空'),

  // UUID验证
  uuid: z.string().uuid('请提供有效的UUID'),

  // 邮箱验证
  email: z.string().email('请输入有效的邮箱地址'),

  // 网址验证（可选）
  website: z.string().url('请输入有效的网址').optional().or(z.literal('')),

  // 用户名验证
  username: z
    .string()
    .min(2, '用户名至少需要2个字符')
    .max(50, '用户名不能超过50个字符')
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文'),

  // 密码验证
  password: z.string().min(6, '密码至少需要6个字符').max(128, '密码不能超过128个字符'),

  // 显示名称验证
  displayName: z.string().min(1, '显示名称不能为空').max(100, '显示名称不能超过100个字符'),
}

// ===== 评论相关验证 =====

// 评论表单验证模式（支持匿名和登录用户）
export const commentSchema = z.object({
  post_slug: baseValidation.postSlug,
  author_name: z.string().min(1, '姓名不能为空').max(100, '姓名不能超过100个字符'),
  author_email: baseValidation.email,
  author_website: baseValidation.website,
  content: z.string().min(1, '评论内容不能为空').max(2000, '评论内容不能超过2000个字符'),
  parent_id: baseValidation.uuid.optional(),
  user_id: baseValidation.uuid.optional(),
  is_anonymous: z.boolean().optional().default(true),
})

// 评论状态更新验证
export const commentUpdateSchema = z.object({
  is_approved: z.boolean(),
})

// 评论查询参数验证
export const commentQuerySchema = z.object({
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce.number().min(1, '每页数量必须大于0').max(50, '每页最多50条').default(10),
})

// ===== 用户认证相关验证 =====

// 用户注册验证
export const userRegistrationSchema = z
  .object({
    email: baseValidation.email,
    password: baseValidation.password,
    display_name: baseValidation.displayName,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: '密码确认不匹配',
    path: ['confirm_password'],
  })

// 用户登录验证
export const userLoginSchema = z.object({
  email: baseValidation.email,
  password: z.string().min(1, '密码不能为空'),
})

// 用户资料更新验证
export const userProfileUpdateSchema = z.object({
  display_name: baseValidation.displayName.optional(),
  bio: z.string().max(500, '个人简介不能超过500个字符').optional(),
  website: baseValidation.website,
  avatar_url: z.string().url('请输入有效的头像URL').optional().or(z.literal('')),
})

// 密码重置验证
export const passwordResetSchema = z.object({
  email: baseValidation.email,
})

// 密码更新验证
export const passwordUpdateSchema = z
  .object({
    current_password: z.string().min(1, '当前密码不能为空'),
    new_password: baseValidation.password,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: '新密码确认不匹配',
    path: ['confirm_password'],
  })

// ===== OAuth相关验证 =====

// QQ OAuth回调验证
export const qqCallbackSchema = z.object({
  code: z.string().min(1, '授权码不能为空'),
  state: z.string().min(1, 'State参数不能为空').optional(),
})

// OAuth状态验证
export const oauthStateSchema = z.object({
  provider: z.enum(['github', 'google', 'discord', 'qq']),
  redirect_to: z.string().url('重定向URL无效').optional(),
})

// ===== 点赞相关验证 =====

// 点赞请求验证
export const likeSchema = z.object({
  post_slug: baseValidation.postSlug,
  user_id: baseValidation.uuid.optional(),
})

// 点赞查询验证
export const likeQuerySchema = z.object({
  post_slug: baseValidation.postSlug,
  user_id: baseValidation.uuid.optional(),
})

// ===== 管理员相关验证 =====

// 管理员评论操作验证
export const adminCommentActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'delete']),
  comment_ids: z.array(baseValidation.uuid).min(1, '至少选择一个评论'),
  reason: z.string().max(200, '操作原因不能超过200个字符').optional(),
})

// 管理员用户操作验证
export const adminUserActionSchema = z.object({
  action: z.enum(['ban', 'unban', 'delete']),
  user_ids: z.array(baseValidation.uuid).min(1, '至少选择一个用户'),
  reason: z.string().max(200, '操作原因不能超过200个字符').optional(),
})

// ===== 搜索相关验证 =====

// 搜索查询验证
export const searchQuerySchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空').max(100, '搜索关键词不能超过100个字符'),
  type: z.enum(['all', 'posts', 'tags', 'authors']).default('all'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(10),
})

// ===== 类型导出 =====

// 评论相关类型
export type CommentFormData = z.infer<typeof commentSchema>
export type CommentUpdateData = z.infer<typeof commentUpdateSchema>
export type CommentQueryParams = z.infer<typeof commentQuerySchema>

// 用户相关类型
export type UserRegistrationData = z.infer<typeof userRegistrationSchema>
export type UserLoginData = z.infer<typeof userLoginSchema>
export type UserProfileUpdateData = z.infer<typeof userProfileUpdateSchema>
export type PasswordResetData = z.infer<typeof passwordResetSchema>
export type PasswordUpdateData = z.infer<typeof passwordUpdateSchema>

// OAuth相关类型
export type QQCallbackData = z.infer<typeof qqCallbackSchema>
export type OAuthStateData = z.infer<typeof oauthStateSchema>

// 点赞相关类型
export type LikeData = z.infer<typeof likeSchema>
export type LikeQueryData = z.infer<typeof likeQuerySchema>

// 管理员相关类型
export type AdminCommentActionData = z.infer<typeof adminCommentActionSchema>
export type AdminUserActionData = z.infer<typeof adminUserActionSchema>

// 搜索相关类型
export type SearchQueryData = z.infer<typeof searchQuerySchema>

// ===== 验证工具函数 =====

/**
 * 安全验证数据并返回结果
 * @param schema Zod验证模式
 * @param data 待验证数据
 * @returns 验证结果
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data)

  if (result.success) {
    return {
      success: true as const,
      data: result.data,
      error: null,
    }
  } else {
    return {
      success: false as const,
      data: null,
      error: result.error.errors[0]?.message || '数据验证失败',
      errors: result.error.errors,
    }
  }
}

/**
 * 格式化验证错误信息
 * @param error Zod错误对象
 * @returns 格式化的错误信息
 */
export function formatValidationError(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}

  error.errors.forEach((err) => {
    const path = err.path.join('.')
    fieldErrors[path] = err.message
  })

  return fieldErrors
}

/**
 * 检查是否为验证错误
 * @param error 错误对象
 * @returns 是否为Zod验证错误
 */
export function isValidationError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError
}
