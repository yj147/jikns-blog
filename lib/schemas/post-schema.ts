import { z } from "zod"

/**
 * 共享的文章验证 Schema
 * 用于 Server Actions 和客户端表单验证
 */

// 基础字段验证规则
const titleSchema = z
  .string()
  .min(3, "文章标题至少需要3个字符")
  .max(200, "文章标题不能超过200个字符")

const contentSchema = z
  .string()
  .min(10, "文章内容至少需要10个字符")
  .max(100000, "文章内容不能超过100,000个字符")

const slugSchema = z
  .string()
  .min(1, "URL路径不能为空")
  .max(100, "URL路径最多100个字符")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "URL路径只能包含小写字母、数字和连字符")

const excerptSchema = z.string().max(500, "文章摘要不能超过500个字符").optional().or(z.literal(""))

const seoTitleSchema = z.string().max(60, "SEO标题不能超过60个字符").optional().or(z.literal(""))

const seoDescriptionSchema = z
  .string()
  .max(160, "SEO描述不能超过160个字符")
  .optional()
  .or(z.literal(""))

const canonicalUrlSchema = z
  .string()
  .url("规范链接格式不正确，请提供有效的URL")
  .optional()
  .or(z.literal(""))

const coverImageSchema = z.string().url("请输入有效的图片URL").optional().or(z.literal(""))

// 创建文章 Schema
export const createPostSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  excerpt: excerptSchema,
  coverImage: coverImageSchema,
  seoTitle: seoTitleSchema,
  seoDescription: seoDescriptionSchema,
  canonicalUrl: canonicalUrlSchema,
  published: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  seriesId: z.string().optional(),
  tagNames: z.array(z.string()).default([]),
})

export type CreatePostInput = z.infer<typeof createPostSchema>

// 更新文章 Schema（所有字段可选）
export const updatePostSchema = z.object({
  title: titleSchema.optional(),
  content: contentSchema.optional(),
  excerpt: excerptSchema,
  coverImage: coverImageSchema,
  seoTitle: seoTitleSchema,
  seoDescription: seoDescriptionSchema,
  canonicalUrl: canonicalUrlSchema,
  published: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  seriesId: z.string().optional().nullable(),
  tagNames: z.array(z.string()).optional(),
})

export type UpdatePostInput = z.infer<typeof updatePostSchema>

// 客户端表单 Schema（用于 PostForm 组件）
export const postFormSchema = z.object({
  title: titleSchema,
  slug: slugSchema,
  content: contentSchema,
  excerpt: excerptSchema,
  coverImage: coverImageSchema,
  tags: z.array(z.string()).default([]),
  isPublished: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  // SEO 字段
  seoTitle: seoTitleSchema,
  seoDescription: seoDescriptionSchema,
  canonicalUrl: canonicalUrlSchema,
})

export type PostFormData = z.infer<typeof postFormSchema>
