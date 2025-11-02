# Phase 5.1 文章管理系统设计方案

**版本**: 1.0  
**日期**: 2025-08-25  
**编制**: Claude Code (基于架构设计文档 v4.1)  
**状态**: ✅ 可实施设计方案

## 目录

1. [设计概述](#1-设计概述)
2. [API/Server Actions 契约](#2-apiserveractions-契约)
3. [权限与状态流转机制](#3-权限与状态流转机制)
4. [编辑器集成点设计](#4-编辑器集成点设计)
5. [测试范围定义](#5-测试范围定义)
6. [实施路线图](#6-实施路线图)

## 1. 设计概述

### 1.1 设计目标

**核心目标**: 为现代化博客项目实现完整的文章管理系统，支持 Markdown 编辑、SEO 优化、发布控制等专业博客功能。

**关键成果**:

- ✅ 管理员专用的文章 CRUD 系统
- ✅ 基于 Markdown 的现代化编辑体验
- ✅ 完整的发布状态控制和 SEO 支持
- ✅ 高安全性的权限验证机制
- ✅ 全面的测试覆盖和质量保障

### 1.2 技术栈确认

基于项目架构设计文档，Phase 5.1 使用以下技术栈：

| 组件       | 技术选型                       | 版本           |
| ---------- | ------------------------------ | -------------- |
| **框架**   | Next.js (App Router)           | ~15.5.x        |
| **语言**   | TypeScript                     | ~5.9.x         |
| **数据库** | Supabase PostgreSQL + Prisma   | ~6.14.x        |
| **UI组件** | shadcn/ui                      | Latest         |
| **编辑器** | @uiw/react-md-editor           | ~4.0.4         |
| **认证**   | Supabase Auth                  | ~2.x           |
| **测试**   | Vitest + React Testing Library | ~2.x + ~15.0.x |

### 1.3 核心数据模型

基于架构设计文档中的 Post 数据模型：

```prisma
model Post {
  id           String   @id @default(cuid())
  slug         String   @unique
  title        String
  content      String   @db.Text
  excerpt      String?
  published    Boolean  @default(false)
  publishedAt  DateTime?
  isPinned     Boolean  @default(false)
  canonicalUrl String?
  seoTitle     String?
  seoDescription String?
  viewCount    Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // 关联关系
  author       User     @relation(fields: [authorId], references: [id])
  authorId     String
  series       Series?  @relation(fields: [seriesId], references: [id])
  seriesId     String?

  // 社交功能
  tags         PostTag[]
  comments     Comment[]
  likes        Like[]
  bookmarks    Bookmark[]
}
```

## 2. API/Server Actions 契约

### 2.1 核心类型定义

```typescript
// 文章创建输入类型
interface CreatePostInput {
  title: string // 文章标题 (1-200字符)
  content: string // Markdown 内容
  excerpt?: string // 摘要 (可选，自动生成或手动输入)
  published?: boolean // 是否立即发布 (默认 false)
  publishedAt?: Date // 定时发布时间 (可选)
  canonicalUrl?: string // SEO canonical URL (可选)
  seoTitle?: string // SEO 标题 (可选)
  seoDescription?: string // SEO 描述 (可选)
  seriesId?: string // 所属系列 (可选)
  tagNames?: string[] // 标签名称数组 (可选)
}

// 文章更新输入类型
interface UpdatePostInput extends Partial<CreatePostInput> {
  id: string // 文章ID (必需)
  slug?: string // URL slug (可选，支持自定义)
}

// 文章查询参数类型
interface GetPostsParams {
  published?: boolean // 发布状态筛选
  authorId?: string // 作者筛选
  seriesId?: string // 系列筛选
  tag?: string // 标签筛选
  search?: string // 全文搜索
  cursor?: string // 分页游标
  limit?: number // 每页数量 (默认10，最大50)
  orderBy?: "publishedAt" | "createdAt" | "updatedAt" | "viewCount"
  order?: "asc" | "desc" // 排序方向 (默认 desc)
}

// API 返回结果类型
interface ApiResult<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

// 分页结果类型
interface PaginatedResult<T> {
  items: T[]
  nextCursor?: string
  hasMore: boolean
  total: number
}
```

### 2.2 Server Actions 契约

#### 2.2.1 文章创建

```typescript
// 文件: lib/actions/posts.ts
"use server"

/**
 * 创建新文章
 * @param input 文章创建数据
 * @returns Promise<ApiResult<Post>>
 */
export async function createPost(
  input: CreatePostInput
): Promise<ApiResult<Post>> {
  try {
    // 1. 权限验证：仅管理员可创建
    const user = await requireAdmin()

    // 2. 输入验证
    const validatedInput = CreatePostSchema.parse(input)

    // 3. 生成 slug（如未提供）
    const slug = await generateUniqueSlug(validatedInput.title)

    // 4. 处理标签关联
    const tagConnections = validatedInput.tagNames
      ? await processPostTags(validatedInput.tagNames)
      : undefined

    // 5. 创建文章
    const post = await prisma.post.create({
      data: {
        ...validatedInput,
        slug,
        authorId: user.id,
        publishedAt: validatedInput.published ? new Date() : null,
        tags: tagConnections,
      },
      include: {
        author: { select: { name: true, avatarUrl: true } },
        series: { select: { title: true, slug: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, likes: true, bookmarks: true } },
      },
    })

    // 6. 清理相关缓存
    await clearPostCaches(post.id)

    return { success: true, data: post }
  } catch (error) {
    return handleApiError(error, "CREATE_POST_FAILED")
  }
}
```

#### 2.2.2 文章更新

```typescript
/**
 * 更新现有文章
 * @param input 文章更新数据
 * @returns Promise<ApiResult<Post>>
 */
export async function updatePost(
  input: UpdatePostInput
): Promise<ApiResult<Post>> {
  try {
    // 1. 权限验证
    const user = await requireAdmin()

    // 2. 输入验证
    const validatedInput = UpdatePostSchema.parse(input)

    // 3. 检查文章存在性
    const existingPost = await prisma.post.findUnique({
      where: { id: validatedInput.id },
    })

    if (!existingPost) {
      return {
        success: false,
        error: { code: "POST_NOT_FOUND", message: "文章不存在" },
      }
    }

    // 4. 处理 slug 冲突
    let finalSlug = validatedInput.slug
    if (finalSlug && finalSlug !== existingPost.slug) {
      finalSlug = await ensureUniqueSlug(finalSlug, validatedInput.id)
    }

    // 5. 处理标签更新
    let tagConnections
    if (validatedInput.tagNames) {
      // 先删除现有标签关联
      await prisma.postTag.deleteMany({
        where: { postId: validatedInput.id },
      })
      // 创建新的标签关联
      tagConnections = await processPostTags(validatedInput.tagNames)
    }

    // 6. 更新文章
    const updatedPost = await prisma.post.update({
      where: { id: validatedInput.id },
      data: {
        ...validatedInput,
        slug: finalSlug,
        updatedAt: new Date(),
        // 发布状态变更时更新 publishedAt
        publishedAt:
          validatedInput.published !== undefined
            ? validatedInput.published
              ? existingPost.publishedAt || new Date()
              : null
            : undefined,
        // 标签更新
        tags: tagConnections ? { create: tagConnections } : undefined,
      },
      include: {
        author: { select: { name: true, avatarUrl: true } },
        series: { select: { title: true, slug: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, likes: true, bookmarks: true } },
      },
    })

    // 7. 清理缓存
    await clearPostCaches(updatedPost.id)

    return { success: true, data: updatedPost }
  } catch (error) {
    return handleApiError(error, "UPDATE_POST_FAILED")
  }
}
```

#### 2.2.3 文章查询

```typescript
/**
 * 获取文章列表 (分页)
 * @param params 查询参数
 * @returns Promise<ApiResult<PaginatedResult<Post>>>
 */
export async function getPosts(
  params: GetPostsParams = {}
): Promise<ApiResult<PaginatedResult<Post>>> {
  try {
    const {
      published,
      authorId,
      seriesId,
      tag,
      search,
      cursor,
      limit = 10,
      orderBy = "publishedAt",
      order = "desc",
    } = params

    // 构建查询条件
    const where: Prisma.PostWhereInput = {
      ...(published !== undefined && { published }),
      ...(authorId && { authorId }),
      ...(seriesId && { seriesId }),
      ...(tag && {
        tags: { some: { tag: { name: tag } } },
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
          { excerpt: { contains: search, mode: "insensitive" } },
        ],
      }),
    }

    // 分页查询
    const posts = await prisma.post.findMany({
      where,
      orderBy: { [orderBy]: order },
      take: Math.min(limit, 50), // 最大50条
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        author: { select: { name: true, avatarUrl: true } },
        series: { select: { title: true, slug: true } },
        tags: {
          include: { tag: { select: { name: true, slug: true } } },
          take: 5, // 最多返回5个标签
        },
        _count: { select: { comments: true, likes: true, bookmarks: true } },
      },
    })

    // 获取总数（仅在需要时计算）
    const total = cursor ? 0 : await prisma.post.count({ where })

    return {
      success: true,
      data: {
        items: posts,
        nextCursor:
          posts.length === limit ? posts[posts.length - 1].id : undefined,
        hasMore: posts.length === limit,
        total,
      },
    }
  } catch (error) {
    return handleApiError(error, "GET_POSTS_FAILED")
  }
}

/**
 * 获取单篇文章详情
 * @param identifier 文章ID或slug
 * @param incrementView 是否增加浏览次数
 * @returns Promise<ApiResult<Post>>
 */
export async function getPost(
  identifier: string,
  incrementView = false
): Promise<ApiResult<Post>> {
  try {
    // 检查是ID还是slug
    const isId = identifier.startsWith("c") // cuid格式

    const post = await prisma.post.findUnique({
      where: isId ? { id: identifier } : { slug: identifier },
      include: {
        author: { select: { name: true, avatarUrl: true, bio: true } },
        series: {
          select: { title: true, slug: true },
          include: {
            posts: {
              select: { id: true, title: true, slug: true, publishedAt: true },
              where: { published: true },
              orderBy: { publishedAt: "asc" },
            },
          },
        },
        tags: {
          include: { tag: { select: { name: true, slug: true } } },
        },
        _count: { select: { comments: true, likes: true, bookmarks: true } },
      },
    })

    if (!post) {
      return {
        success: false,
        error: { code: "POST_NOT_FOUND", message: "文章不存在" },
      }
    }

    // 增加浏览次数（异步，不阻塞返回）
    if (incrementView && post.published) {
      prisma.post
        .update({
          where: { id: post.id },
          data: { viewCount: { increment: 1 } },
        })
        .catch(console.error)
    }

    return { success: true, data: post }
  } catch (error) {
    return handleApiError(error, "GET_POST_FAILED")
  }
}
```

#### 2.2.4 文章状态操作

```typescript
/**
 * 发布文章
 * @param postId 文章ID
 * @returns Promise<ApiResult<Post>>
 */
export async function publishPost(postId: string): Promise<ApiResult<Post>> {
  try {
    await requireAdmin()

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        published: true,
        publishedAt: new Date(),
      },
      include: {
        author: { select: { name: true, avatarUrl: true } },
        tags: { include: { tag: true } },
      },
    })

    await clearPostCaches(postId)

    return { success: true, data: post }
  } catch (error) {
    return handleApiError(error, "PUBLISH_POST_FAILED")
  }
}

/**
 * 取消发布文章
 * @param postId 文章ID
 * @returns Promise<ApiResult<Post>>
 */
export async function unpublishPost(postId: string): Promise<ApiResult<Post>> {
  try {
    await requireAdmin()

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        published: false,
        publishedAt: null,
      },
    })

    await clearPostCaches(postId)

    return { success: true, data: post }
  } catch (error) {
    return handleApiError(error, "UNPUBLISH_POST_FAILED")
  }
}

/**
 * 切换文章置顶状态
 * @param postId 文章ID
 * @returns Promise<ApiResult<Post>>
 */
export async function togglePinPost(postId: string): Promise<ApiResult<Post>> {
  try {
    await requireAdmin()

    const existingPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { isPinned: true },
    })

    if (!existingPost) {
      return {
        success: false,
        error: { code: "POST_NOT_FOUND", message: "文章不存在" },
      }
    }

    const post = await prisma.post.update({
      where: { id: postId },
      data: { isPinned: !existingPost.isPinned },
    })

    await clearPostCaches(postId)

    return { success: true, data: post }
  } catch (error) {
    return handleApiError(error, "TOGGLE_PIN_FAILED")
  }
}

/**
 * 删除文章
 * @param postId 文章ID
 * @returns Promise<ApiResult<void>>
 */
export async function deletePost(postId: string): Promise<ApiResult<void>> {
  try {
    await requireAdmin()

    // 级联删除：评论、点赞、收藏、标签关联会自动删除
    await prisma.post.delete({
      where: { id: postId },
    })

    await clearPostCaches(postId)

    return { success: true }
  } catch (error) {
    return handleApiError(error, "DELETE_POST_FAILED")
  }
}
```

#### 2.2.5 辅助功能 API

```typescript
/**
 * 生成唯一 slug
 * @param title 文章标题
 * @param excludeId 排除的文章ID（用于更新时）
 * @returns Promise<string>
 */
export async function generateUniqueSlug(
  title: string,
  excludeId?: string
): Promise<string> {
  const baseSlug = slugify(title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  })

  let finalSlug = baseSlug
  let counter = 1

  while (await isSlugExists(finalSlug, excludeId)) {
    finalSlug = `${baseSlug}-${counter}`
    counter++
  }

  return finalSlug
}

/**
 * 上传图片（编辑器使用）
 * @param file 图片文件
 * @returns Promise<ApiResult<{ url: string }>>
 */
export async function uploadPostImage(
  formData: FormData
): Promise<ApiResult<{ url: string }>> {
  try {
    await requireAdmin()

    const file = formData.get("file") as File
    if (!file) {
      return {
        success: false,
        error: { code: "NO_FILE", message: "未选择文件" },
      }
    }

    // 验证文件类型和大小
    if (!file.type.startsWith("image/")) {
      return {
        success: false,
        error: { code: "INVALID_FILE_TYPE", message: "仅支持图片文件" },
      }
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB
      return {
        success: false,
        error: { code: "FILE_TOO_LARGE", message: "文件大小不能超过10MB" },
      }
    }

    // 上传到 Supabase Storage
    const fileName = `posts/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from("images")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      throw error
    }

    // 获取公共访问URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(data.path)

    return { success: true, data: { url: publicUrl } }
  } catch (error) {
    return handleApiError(error, "UPLOAD_IMAGE_FAILED")
  }
}
```

### 2.3 输入验证 Schema

```typescript
// 文件: lib/schemas/post.ts
import { z } from "zod"

export const CreatePostSchema = z.object({
  title: z.string().min(1, "标题不能为空").max(200, "标题长度不能超过200字符"),
  content: z.string().min(1, "内容不能为空"),
  excerpt: z.string().max(500, "摘要长度不能超过500字符").optional(),
  published: z.boolean().default(false),
  publishedAt: z.date().optional(),
  canonicalUrl: z.string().url("Canonical URL格式不正确").optional(),
  seoTitle: z.string().max(60, "SEO标题长度不能超过60字符").optional(),
  seoDescription: z.string().max(160, "SEO描述长度不能超过160字符").optional(),
  seriesId: z.string().cuid().optional(),
  tagNames: z
    .array(z.string().min(1).max(50))
    .max(10, "最多可以添加10个标签")
    .optional(),
})

export const UpdatePostSchema = CreatePostSchema.extend({
  id: z.string().cuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug只能包含小写字母、数字和连字符")
    .min(1)
    .max(100)
    .optional(),
})
  .partial()
  .required({ id: true })

export const GetPostsParamsSchema = z.object({
  published: z.boolean().optional(),
  authorId: z.string().cuid().optional(),
  seriesId: z.string().cuid().optional(),
  tag: z.string().optional(),
  search: z.string().min(1).optional(),
  cursor: z.string().cuid().optional(),
  limit: z.number().min(1).max(50).default(10),
  orderBy: z
    .enum(["publishedAt", "createdAt", "updatedAt", "viewCount"])
    .default("publishedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
})
```

## 3. 权限与状态流转机制

### 3.1 权限控制架构

#### 3.1.1 角色定义

基于架构设计文档中的用户角色系统：

```typescript
// 用户角色枚举
enum Role {
  USER = "USER", // 普通用户：只能查看已发布内容
  ADMIN = "ADMIN", // 管理员：拥有文章管理全部权限
}

enum UserStatus {
  ACTIVE = "ACTIVE", // 活跃状态：可正常访问
  BANNED = "BANNED", // 封禁状态：禁止所有操作
}
```

#### 3.1.2 权限验证中间件

```typescript
// 文件: lib/auth/permissions.ts

/**
 * 权限验证基础函数
 */
export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  return await prisma.user.findUnique({
    where: { email: user.email! },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      avatarUrl: true,
    },
  })
}

/**
 * 要求用户已登录
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("AUTH_REQUIRED")
  }
  if (user.status === "BANNED") {
    throw new Error("USER_BANNED")
  }
  return user
}

/**
 * 要求管理员权限
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireAuth()
  if (user.role !== "ADMIN") {
    throw new Error("ADMIN_REQUIRED")
  }
  return user
}

/**
 * 权限检查函数
 */
export function canManagePosts(user: User | null): boolean {
  return user?.role === "ADMIN" && user?.status === "ACTIVE"
}

export function canViewPost(post: Post, user: User | null): boolean {
  // 已发布的文章所有人都可查看
  if (post.published) return true

  // 草稿只有作者（管理员）可查看
  return user?.role === "ADMIN" && user?.id === post.authorId
}
```

#### 3.1.3 API 层权限验证

```typescript
// 文件: lib/middleware/auth.ts

/**
 * Server Action 权限装饰器
 */
export function withAuth<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  requiredRole?: Role
) {
  return async (...args: T): Promise<R> => {
    try {
      const user = await getCurrentUser()

      if (!user) {
        throw new Error("登录后才能执行此操作")
      }

      if (user.status === "BANNED") {
        throw new Error("您的账号已被封禁，无法执行此操作")
      }

      if (requiredRole && user.role !== requiredRole) {
        throw new Error("权限不足，无法执行此操作")
      }

      return await handler(...args)
    } catch (error) {
      console.error("权限验证失败:", error)
      throw error
    }
  }
}

// 使用示例
export const createPost = withAuth(createPostHandler, "ADMIN")
export const updatePost = withAuth(updatePostHandler, "ADMIN")
```

### 3.2 文章状态流转机制

#### 3.2.1 状态定义

```typescript
// 文章状态类型
interface PostState {
  published: boolean // 发布状态：true=已发布，false=草稿
  publishedAt: Date | null // 发布时间：null表示从未发布过
  isPinned: boolean // 置顶状态：仅影响显示顺序
}

// 状态转换枚举
enum PostAction {
  CREATE_DRAFT = "CREATE_DRAFT", // 创建草稿
  CREATE_PUBLISHED = "CREATE_PUBLISHED", // 创建并发布
  PUBLISH = "PUBLISH", // 发布草稿
  UNPUBLISH = "UNPUBLISH", // 取消发布
  PIN = "PIN", // 置顶
  UNPIN = "UNPIN", // 取消置顶
  DELETE = "DELETE", // 删除
}
```

#### 3.2.2 状态转换逻辑

```typescript
// 文件: lib/utils/post-state.ts

/**
 * 文章状态机
 */
export class PostStateMachine {
  /**
   * 验证状态转换是否有效
   */
  static canTransition(
    currentState: PostState,
    action: PostAction,
    user: User
  ): boolean {
    // 权限检查：只有管理员可以操作
    if (!canManagePosts(user)) {
      return false
    }

    switch (action) {
      case PostAction.CREATE_DRAFT:
      case PostAction.CREATE_PUBLISHED:
        return true // 总是可以创建

      case PostAction.PUBLISH:
        return !currentState.published // 只能发布草稿

      case PostAction.UNPUBLISH:
        return currentState.published // 只能取消发布已发布的文章

      case PostAction.PIN:
        return currentState.published && !currentState.isPinned // 只能置顶已发布且未置顶的文章

      case PostAction.UNPIN:
        return currentState.isPinned // 只能取消置顶已置顶的文章

      case PostAction.DELETE:
        return true // 总是可以删除（需要管理员权限）

      default:
        return false
    }
  }

  /**
   * 执行状态转换
   */
  static transition(
    currentState: PostState,
    action: PostAction
  ): Partial<PostState> {
    if (!this.canTransition(currentState, action, getCurrentUser())) {
      throw new Error(`无效的状态转换: ${action}`)
    }

    const now = new Date()

    switch (action) {
      case PostAction.CREATE_DRAFT:
        return {
          published: false,
          publishedAt: null,
          isPinned: false,
        }

      case PostAction.CREATE_PUBLISHED:
        return {
          published: true,
          publishedAt: now,
          isPinned: false,
        }

      case PostAction.PUBLISH:
        return {
          published: true,
          publishedAt: currentState.publishedAt || now,
        }

      case PostAction.UNPUBLISH:
        return {
          published: false,
          publishedAt: null, // 清空发布时间
          isPinned: false, // 取消置顶
        }

      case PostAction.PIN:
        return { isPinned: true }

      case PostAction.UNPIN:
        return { isPinned: false }

      default:
        return {}
    }
  }
}
```

#### 3.2.3 状态转换 API

```typescript
// 状态转换的统一接口
export async function transitionPostState(
  postId: string,
  action: PostAction
): Promise<ApiResult<Post>> {
  try {
    const user = await requireAdmin()

    const currentPost = await prisma.post.findUnique({
      where: { id: postId },
      select: { published: true, publishedAt: true, isPinned: true },
    })

    if (!currentPost) {
      return {
        success: false,
        error: { code: "POST_NOT_FOUND", message: "文章不存在" },
      }
    }

    // 验证状态转换
    if (!PostStateMachine.canTransition(currentPost, action, user)) {
      return {
        success: false,
        error: {
          code: "INVALID_TRANSITION",
          message: `无法执行操作: ${action}`,
        },
      }
    }

    // 执行状态转换
    const newState = PostStateMachine.transition(currentPost, action)

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: newState,
      include: {
        author: { select: { name: true, avatarUrl: true } },
        _count: { select: { comments: true, likes: true } },
      },
    })

    await clearPostCaches(postId)

    return { success: true, data: updatedPost }
  } catch (error) {
    return handleApiError(error, "STATE_TRANSITION_FAILED")
  }
}
```

### 3.3 安全性保障

#### 3.3.1 输入清理和验证

```typescript
// 内容安全处理
export function sanitizePostContent(content: string): string {
  // Markdown 内容清理
  return DOMPurify.sanitize(marked(content), {
    ALLOWED_TAGS: [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "a",
      "img",
      "blockquote",
      "code",
      "pre",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    ALLOWED_ATTR: {
      a: ["href", "title", "target"],
      img: ["src", "alt", "title", "width", "height"],
      code: ["class"],
    },
    ALLOWED_URI_REGEXP:
      /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}

// Slug 验证
export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/
  return slugRegex.test(slug) && slug.length >= 1 && slug.length <= 100
}
```

#### 3.3.2 数据访问控制

```typescript
// 行级安全控制
export function buildPostWhereClause(user: User | null): Prisma.PostWhereInput {
  const baseWhere: Prisma.PostWhereInput = {}

  // 非管理员用户只能查看已发布的文章
  if (!user || user.role !== "ADMIN") {
    baseWhere.published = true
  }

  // 封禁用户无法查看任何内容
  if (user?.status === "BANNED") {
    baseWhere.id = "never-exists" // 永远不匹配的条件
  }

  return baseWhere
}
```

## 4. 编辑器集成点设计

### 4.1 编辑器架构设计

基于编辑器选型决策文档，Phase 5.1 使用 Markdown 编辑器方案：

```typescript
// 编辑器配置类型
interface MarkdownEditorConfig {
  value: string;                    // Markdown 内容
  onChange: (value: string) => void; // 内容变更回调
  placeholder?: string;             // 占位符文本
  height?: number;                  // 编辑器高度
  preview?: 'edit' | 'live' | 'preview'; // 预览模式
  hideToolbar?: boolean;            // 是否隐藏工具栏
  visibleDragBar?: boolean;         // 是否显示拖拽条
  data-color-mode?: 'light' | 'dark'; // 主题模式
}

// 图片上传配置
interface ImageUploadConfig {
  maxSize: number;                  // 最大文件大小 (bytes)
  allowedTypes: string[];           // 允许的文件类型
  uploadPath: string;               // 上传路径前缀
  onUpload: (file: File) => Promise<string>; // 上传处理函数
  onError: (error: Error) => void;  // 错误处理函数
}
```

### 4.2 核心编辑器组件

```typescript
// 文件: components/editor/markdown-editor.tsx
'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { uploadPostImage } from '@/lib/actions/posts';

// 动态加载编辑器，避免 SSR 问题
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
);

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number;
  className?: string;
  disabled?: boolean;
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = '开始编写你的文章...',
  height = 500,
  className = '',
  disabled = false
}: MarkdownEditorProps) {
  const [uploading, setUploading] = useState(false);

  // 图片上传处理
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('图片大小不能超过 10MB');
      throw new Error('文件过大');
    }

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      throw new Error('文件类型不正确');
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await uploadPostImage(formData);

      if (!result.success) {
        throw new Error(result.error?.message || '上传失败');
      }

      toast.success('图片上传成功');
      return result.data!.url;

    } catch (error) {
      console.error('图片上传失败:', error);
      toast.error('图片上传失败，请重试');
      throw error;
    } finally {
      setUploading(false);
    }
  }, []);

  // 处理粘贴图片
  const handlePaste = useCallback(async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        event.preventDefault();

        const file = item.getAsFile();
        if (!file) continue;

        try {
          const url = await handleImageUpload(file);
          const imageMarkdown = `![${file.name}](${url})`;

          // 插入到当前光标位置
          const textarea = event.target as HTMLTextAreaElement;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = value.substring(0, start) + imageMarkdown + value.substring(end);

          onChange(newValue);
        } catch (error) {
          // 错误已在 handleImageUpload 中处理
        }

        break;
      }
    }
  }, [value, onChange, handleImageUpload]);

  // 处理拖拽上传
  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        try {
          const url = await handleImageUpload(file);
          const imageMarkdown = `![${file.name}](${url})\n`;
          onChange(value + imageMarkdown);
        } catch (error) {
          // 错误已在 handleImageUpload 中处理
        }
      }
    }
  }, [value, onChange, handleImageUpload]);

  return (
    <div className={className}>
      <MDEditor
        value={value}
        onChange={(val = '') => onChange(val)}
        height={height}
        data-color-mode="light" // 将根据主题动态切换
        preview="live"
        hideToolbar={false}
        visibleDragBar={false}
        textareaProps={{
          placeholder,
          disabled,
          onPaste: handlePaste,
          onDrop: handleDrop,
          onDragOver: (e) => e.preventDefault(),
          style: { fontSize: 14, lineHeight: 1.6 }
        }}
        previewOptions={{
          rehypePlugins: [
            // 代码高亮
            [rehypeHighlight, { ignoreMissing: true }],
            // 外部链接处理
            [rehypeExternalLinks, { target: '_blank', rel: 'noopener noreferrer' }]
          ]
        }}
      />

      {uploading && (
        <div className="mt-2 text-sm text-muted-foreground">
          正在上传图片...
        </div>
      )}
    </div>
  );
}
```

### 4.3 表单集成组件

```typescript
// 文件: components/admin/post-form.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePostSchema } from '@/lib/schemas/post';
import { MarkdownEditor } from '@/components/editor/markdown-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface PostFormProps {
  initialData?: Partial<Post>;
  onSubmit: (data: CreatePostInput) => Promise<void>;
  isLoading?: boolean;
}

export function PostForm({ initialData, onSubmit, isLoading = false }: PostFormProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const form = useForm<CreatePostInput>({
    resolver: zodResolver(CreatePostSchema),
    defaultValues: {
      title: initialData?.title || '',
      content: initialData?.content || '',
      excerpt: initialData?.excerpt || '',
      published: initialData?.published || false,
      canonicalUrl: initialData?.canonicalUrl || '',
      seoTitle: initialData?.seoTitle || '',
      seoDescription: initialData?.seoDescription || '',
      tagNames: [], // 从关联的标签中提取
      ...initialData
    }
  });

  const handleSubmit = async (data: CreatePostInput) => {
    try {
      await onSubmit(data);
      toast.success(initialData ? '文章更新成功' : '文章创建成功');
    } catch (error) {
      toast.error('操作失败，请重试');
      console.error('提交失败:', error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 标题 */}
          <div className="space-y-2">
            <Label htmlFor="title">文章标题 *</Label>
            <Input
              id="title"
              {...form.register('title')}
              placeholder="输入文章标题"
              className="text-lg"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          {/* 摘要 */}
          <div className="space-y-2">
            <Label htmlFor="excerpt">文章摘要</Label>
            <Textarea
              id="excerpt"
              {...form.register('excerpt')}
              placeholder="输入文章摘要（可选，用于搜索和分享）"
              rows={3}
            />
            {form.formState.errors.excerpt && (
              <p className="text-sm text-destructive">
                {form.formState.errors.excerpt.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 内容编辑 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>文章内容</CardTitle>
          <div className="flex items-center space-x-2">
            <Switch
              checked={isPreviewMode}
              onCheckedChange={setIsPreviewMode}
            />
            <Label>预览模式</Label>
          </div>
        </CardHeader>
        <CardContent>
          <MarkdownEditor
            value={form.watch('content')}
            onChange={(value) => form.setValue('content', value)}
            placeholder="开始编写你的文章..."
            height={600}
          />
          {form.formState.errors.content && (
            <p className="text-sm text-destructive mt-2">
              {form.formState.errors.content.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* SEO 设置 */}
      <Card>
        <CardHeader>
          <CardTitle>SEO 设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seoTitle">SEO 标题</Label>
              <Input
                id="seoTitle"
                {...form.register('seoTitle')}
                placeholder="自定义搜索引擎标题"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="canonicalUrl">Canonical URL</Label>
              <Input
                id="canonicalUrl"
                {...form.register('canonicalUrl')}
                placeholder="https://example.com/original-article"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seoDescription">SEO 描述</Label>
            <Textarea
              id="seoDescription"
              {...form.register('seoDescription')}
              placeholder="搜索引擎结果页面显示的描述"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* 发布设置 */}
      <Card>
        <CardHeader>
          <CardTitle>发布设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              checked={form.watch('published')}
              onCheckedChange={(checked) => form.setValue('published', checked)}
            />
            <Label>立即发布</Label>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* 提交按钮 */}
      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => form.setValue('published', false)}
          disabled={isLoading}
        >
          保存草稿
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? '保存中...' : (form.watch('published') ? '发布文章' : '保存文章')}
        </Button>
      </div>
    </form>
  );
}
```

### 4.4 编辑器扩展功能

#### 4.4.1 自动保存功能

```typescript
// 文件: hooks/use-auto-save.ts
import { useEffect, useRef } from "react"
import { useDebouncedCallback } from "use-debounce"

interface AutoSaveOptions {
  delay?: number // 延迟时间（毫秒）
  key: string // 本地存储键名
}

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  options: AutoSaveOptions
) {
  const { delay = 2000, key } = options
  const isInitialRender = useRef(true)

  const debouncedSave = useDebouncedCallback(async (data: T) => {
    try {
      await onSave(data)
      // 保存成功后清除本地备份
      localStorage.removeItem(key)
    } catch (error) {
      // 保存失败时备份到本地
      localStorage.setItem(key, JSON.stringify(data))
      console.error("自动保存失败:", error)
    }
  }, delay)

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }

    debouncedSave(data)
  }, [data, debouncedSave])

  // 恢复本地备份
  const restoreFromBackup = (): T | null => {
    try {
      const backup = localStorage.getItem(key)
      return backup ? JSON.parse(backup) : null
    } catch {
      return null
    }
  }

  return { restoreFromBackup }
}
```

#### 4.4.2 编辑器工具栏扩展

```typescript
// 自定义工具栏命令
const customCommands = [
  // 插入代码块
  {
    name: 'code-block',
    keyCommand: 'code-block',
    buttonProps: { 'aria-label': '插入代码块', title: '插入代码块' },
    icon: <Code className="w-4 h-4" />,
    execute: (state: ExecuteState, api: TextAreaCommandOrchestrator) => {
      const selection = api.getSelectionText();
      api.replaceSelection(`\`\`\`\n${selection}\n\`\`\``);
    }
  },

  // 插入表格
  {
    name: 'table',
    keyCommand: 'table',
    buttonProps: { 'aria-label': '插入表格', title: '插入表格' },
    icon: <Table className="w-4 h-4" />,
    execute: (state: ExecuteState, api: TextAreaCommandOrchestrator) => {
      const table = `
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 内容 | 内容 | 内容 |
| 内容 | 内容 | 内容 |
`;
      api.replaceSelection(table.trim());
    }
  },

  // 插入当前时间
  {
    name: 'timestamp',
    keyCommand: 'timestamp',
    buttonProps: { 'aria-label': '插入时间戳', title: '插入时间戳' },
    icon: <Clock className="w-4 h-4" />,
    execute: (state: ExecuteState, api: TextAreaCommandOrchestrator) => {
      const timestamp = new Date().toLocaleString('zh-CN');
      api.replaceSelection(timestamp);
    }
  }
];
```

## 5. 测试范围定义

### 5.1 测试策略概述

基于项目技术栈，Phase 5.1 采用多层测试策略：

| 测试类型     | 工具                           | 覆盖范围                 | 目标覆盖率 |
| ------------ | ------------------------------ | ------------------------ | ---------- |
| **单元测试** | Vitest                         | Server Actions, 工具函数 | >90%       |
| **组件测试** | Vitest + React Testing Library | UI组件, 表单验证         | >80%       |
| **集成测试** | Vitest + 测试数据库            | API端到端流程            | >70%       |
| **E2E测试**  | Playwright                     | 用户完整流程             | 核心场景   |

### 5.2 单元测试范围

#### 5.2.1 Server Actions 测试

```typescript
// 文件: tests/lib/actions/posts.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createPost, updatePost, deletePost } from "@/lib/actions/posts"
import { prismaMock } from "../../../__mocks__/prisma"

// Mock 认证
vi.mock("@/lib/auth/permissions", () => ({
  requireAdmin: vi.fn().mockResolvedValue({
    id: "admin-user-id",
    role: "ADMIN",
    status: "ACTIVE",
  }),
}))

describe("文章管理 Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("createPost", () => {
    it("应该成功创建草稿文章", async () => {
      const input = {
        title: "测试文章",
        content: "这是测试内容",
        published: false,
      }

      const mockPost = {
        id: "post-id",
        ...input,
        slug: "test-article",
        authorId: "admin-user-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      prismaMock.post.create.mockResolvedValue(mockPost)

      const result = await createPost(input)

      expect(result.success).toBe(true)
      expect(result.data?.title).toBe(input.title)
      expect(prismaMock.post.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: input.title,
          content: input.content,
          published: false,
          authorId: "admin-user-id",
        }),
        include: expect.any(Object),
      })
    })

    it("应该在标题为空时返回错误", async () => {
      const input = {
        title: "",
        content: "内容",
        published: false,
      }

      const result = await createPost(input)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("VALIDATION_ERROR")
    })

    it("应该处理重复的 slug", async () => {
      const input = {
        title: "重复标题",
        content: "内容",
        published: false,
      }

      // 模拟 slug 已存在
      prismaMock.post.findUnique
        .mockResolvedValueOnce({ id: "existing-post" }) // 第一次查询返回存在
        .mockResolvedValueOnce(null) // 第二次查询返回不存在

      prismaMock.post.create.mockResolvedValue({
        id: "new-post-id",
        ...input,
        slug: "duplicate-title-1", // 应该生成带数字的 slug
        authorId: "admin-user-id",
      })

      const result = await createPost(input)

      expect(result.success).toBe(true)
      expect(result.data?.slug).toBe("duplicate-title-1")
    })
  })

  describe("updatePost", () => {
    it("应该成功更新文章", async () => {
      const input = {
        id: "post-id",
        title: "更新后的标题",
      }

      prismaMock.post.findUnique.mockResolvedValue({
        id: "post-id",
        title: "原标题",
        slug: "original-title",
      })

      prismaMock.post.update.mockResolvedValue({
        id: "post-id",
        title: "更新后的标题",
        slug: "original-title",
      })

      const result = await updatePost(input)

      expect(result.success).toBe(true)
      expect(prismaMock.post.update).toHaveBeenCalledWith({
        where: { id: "post-id" },
        data: expect.objectContaining({
          title: "更新后的标题",
        }),
        include: expect.any(Object),
      })
    })

    it("应该在文章不存在时返回错误", async () => {
      prismaMock.post.findUnique.mockResolvedValue(null)

      const result = await updatePost({
        id: "non-existent-id",
        title: "新标题",
      })

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe("POST_NOT_FOUND")
    })
  })
})
```

#### 5.2.2 工具函数测试

```typescript
// 文件: tests/lib/utils/post-state.test.ts
import { describe, it, expect } from "vitest"
import { PostStateMachine, PostAction } from "@/lib/utils/post-state"

describe("PostStateMachine", () => {
  const adminUser = {
    id: "admin-id",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  }

  const regularUser = {
    id: "user-id",
    role: "USER" as const,
    status: "ACTIVE" as const,
  }

  describe("canTransition", () => {
    it("应该允许管理员发布草稿", () => {
      const currentState = {
        published: false,
        publishedAt: null,
        isPinned: false,
      }

      const canPublish = PostStateMachine.canTransition(
        currentState,
        PostAction.PUBLISH,
        adminUser
      )

      expect(canPublish).toBe(true)
    })

    it("应该禁止普通用户发布文章", () => {
      const currentState = {
        published: false,
        publishedAt: null,
        isPinned: false,
      }

      const canPublish = PostStateMachine.canTransition(
        currentState,
        PostAction.PUBLISH,
        regularUser
      )

      expect(canPublish).toBe(false)
    })

    it("应该禁止发布已发布的文章", () => {
      const currentState = {
        published: true,
        publishedAt: new Date(),
        isPinned: false,
      }

      const canPublish = PostStateMachine.canTransition(
        currentState,
        PostAction.PUBLISH,
        adminUser
      )

      expect(canPublish).toBe(false)
    })
  })

  describe("transition", () => {
    it("应该正确处理发布转换", () => {
      const currentState = {
        published: false,
        publishedAt: null,
        isPinned: false,
      }

      const newState = PostStateMachine.transition(
        currentState,
        PostAction.PUBLISH
      )

      expect(newState.published).toBe(true)
      expect(newState.publishedAt).toBeInstanceOf(Date)
    })

    it("应该在取消发布时清除相关状态", () => {
      const currentState = {
        published: true,
        publishedAt: new Date(),
        isPinned: true,
      }

      const newState = PostStateMachine.transition(
        currentState,
        PostAction.UNPUBLISH
      )

      expect(newState.published).toBe(false)
      expect(newState.publishedAt).toBe(null)
      expect(newState.isPinned).toBe(false)
    })
  })
})
```

### 5.3 组件测试范围

#### 5.3.1 编辑器组件测试

```typescript
// 文件: tests/components/editor/markdown-editor.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownEditor } from '@/components/editor/markdown-editor';

// Mock 文件上传
vi.mock('@/lib/actions/posts', () => ({
  uploadPostImage: vi.fn().mockResolvedValue({
    success: true,
    data: { url: 'https://example.com/image.jpg' }
  })
}));

describe('MarkdownEditor', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    placeholder: '开始编写...'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染编辑器并显示占位符', async () => {
    render(<MarkdownEditor {...defaultProps} />);

    // 等待动态导入完成
    await waitFor(() => {
      expect(screen.getByText('开始编写...')).toBeInTheDocument();
    });
  });

  it('应该处理文本输入', async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor {...defaultProps} onChange={onChange} />);

    const textarea = await screen.findByRole('textbox');
    await userEvent.type(textarea, '# 标题');

    expect(onChange).toHaveBeenCalledWith('# 标题');
  });

  it('应该处理图片粘贴', async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor {...defaultProps} onChange={onChange} />);

    const textarea = await screen.findByRole('textbox');

    // 模拟粘贴图片
    const file = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
    const clipboardData = {
      items: [{
        type: 'image/jpeg',
        getAsFile: () => file
      }]
    };

    fireEvent.paste(textarea, { clipboardData });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('![test.jpg](https://example.com/image.jpg)');
    });
  });

  it('应该处理拖拽上传', async () => {
    const onChange = vi.fn();
    render(<MarkdownEditor {...defaultProps} value="原内容" onChange={onChange} />);

    const textarea = await screen.findByRole('textbox');

    // 模拟拖拽图片
    const file = new File(['image content'], 'dropped.png', { type: 'image/png' });
    const dataTransfer = {
      files: [file]
    };

    fireEvent.drop(textarea, { dataTransfer });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('原内容![dropped.png](https://example.com/image.jpg)\n');
    });
  });
});
```

#### 5.3.2 表单组件测试

```typescript
// 文件: tests/components/admin/post-form.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostForm } from '@/components/admin/post-form';

describe('PostForm', () => {
  const mockOnSubmit = vi.fn();

  const defaultProps = {
    onSubmit: mockOnSubmit,
    isLoading: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该渲染所有必需的表单字段', () => {
    render(<PostForm {...defaultProps} />);

    expect(screen.getByLabelText('文章标题 *')).toBeInTheDocument();
    expect(screen.getByLabelText('文章摘要')).toBeInTheDocument();
    expect(screen.getByLabelText('SEO 标题')).toBeInTheDocument();
    expect(screen.getByLabelText('SEO 描述')).toBeInTheDocument();
    expect(screen.getByLabelText('立即发布')).toBeInTheDocument();
  });

  it('应该使用初始数据填充表单', () => {
    const initialData = {
      title: '测试文章',
      content: '测试内容',
      excerpt: '测试摘要',
      published: true
    };

    render(<PostForm {...defaultProps} initialData={initialData} />);

    expect(screen.getByDisplayValue('测试文章')).toBeInTheDocument();
    expect(screen.getByDisplayValue('测试摘要')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '立即发布' })).toBeChecked();
  });

  it('应该显示验证错误', async () => {
    render(<PostForm {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /保存|发布/ });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('标题不能为空')).toBeInTheDocument();
    });
  });

  it('应该提交有效的表单数据', async () => {
    render(<PostForm {...defaultProps} />);

    await userEvent.type(screen.getByLabelText('文章标题 *'), '新文章');
    // 编辑器组件需要特殊处理，这里简化处理

    const submitButton = screen.getByRole('button', { name: /保存|发布/ });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '新文章'
        })
      );
    });
  });

  it('应该在加载时禁用表单', () => {
    render(<PostForm {...defaultProps} isLoading={true} />);

    const submitButton = screen.getByRole('button', { name: /保存中/ });
    expect(submitButton).toBeDisabled();
  });
});
```

### 5.4 集成测试范围

#### 5.4.1 API 端到端测试

```typescript
// 文件: tests/integration/posts-api.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { createTestDatabase, cleanupTestDatabase } from "../helpers/test-db"
import { createTestUser } from "../helpers/test-users"
import {
  createPost,
  getPosts,
  updatePost,
  deletePost,
} from "@/lib/actions/posts"

describe("文章管理 API 集成测试", () => {
  let adminUser: User
  let testDb: any

  beforeAll(async () => {
    testDb = await createTestDatabase()
    adminUser = await createTestUser({ role: "ADMIN" })
  })

  afterAll(async () => {
    await cleanupTestDatabase(testDb)
  })

  beforeEach(async () => {
    // 清理测试数据
    await testDb.post.deleteMany()
    await testDb.tag.deleteMany()
  })

  it("应该完成完整的文章生命周期", async () => {
    // 1. 创建草稿
    const createResult = await createPost({
      title: "集成测试文章",
      content: "这是集成测试内容",
      published: false,
      tagNames: ["测试", "集成"],
    })

    expect(createResult.success).toBe(true)
    expect(createResult.data?.published).toBe(false)
    expect(createResult.data?.tags).toHaveLength(2)

    const postId = createResult.data!.id

    // 2. 更新文章
    const updateResult = await updatePost({
      id: postId,
      title: "更新后的标题",
      published: true,
    })

    expect(updateResult.success).toBe(true)
    expect(updateResult.data?.title).toBe("更新后的标题")
    expect(updateResult.data?.published).toBe(true)
    expect(updateResult.data?.publishedAt).toBeInstanceOf(Date)

    // 3. 查询文章列表
    const listResult = await getPosts({ published: true })

    expect(listResult.success).toBe(true)
    expect(listResult.data?.items).toHaveLength(1)
    expect(listResult.data?.items[0].title).toBe("更新后的标题")

    // 4. 删除文章
    const deleteResult = await deletePost(postId)

    expect(deleteResult.success).toBe(true)

    // 5. 验证删除
    const finalListResult = await getPosts({})

    expect(finalListResult.success).toBe(true)
    expect(finalListResult.data?.items).toHaveLength(0)
  })

  it("应该正确处理标签关联", async () => {
    // 创建带标签的文章
    const result = await createPost({
      title: "标签测试文章",
      content: "测试标签功能",
      tagNames: ["JavaScript", "React", "TypeScript"],
    })

    expect(result.success).toBe(true)
    expect(result.data?.tags).toHaveLength(3)

    // 验证标签已创建
    const tags = await testDb.tag.findMany()
    expect(tags).toHaveLength(3)

    // 更新标签
    const updateResult = await updatePost({
      id: result.data!.id,
      tagNames: ["Vue", "TypeScript"], // 保留 TypeScript，移除其他，添加 Vue
    })

    expect(updateResult.success).toBe(true)
    expect(updateResult.data?.tags).toHaveLength(2)

    // 验证旧的关联已删除，新的关联已创建
    const postTags = await testDb.postTag.findMany({
      where: { postId: result.data!.id },
      include: { tag: true },
    })

    const tagNames = postTags.map((pt: any) => pt.tag.name)
    expect(tagNames).toEqual(expect.arrayContaining(["Vue", "TypeScript"]))
  })
})
```

### 5.5 E2E 测试范围

#### 5.5.1 文章管理流程测试

```typescript
// 文件: tests/e2e/post-management.spec.ts
import { test, expect } from "@playwright/test"

test.describe("文章管理功能", () => {
  test.beforeEach(async ({ page }) => {
    // 登录为管理员
    await page.goto("/login")
    await page.fill("[data-testid=email]", "admin@example.com")
    await page.fill("[data-testid=password]", "password123")
    await page.click("[data-testid=login-submit]")
    await expect(page).toHaveURL("/admin")
  })

  test("应该能创建、编辑和发布文章", async ({ page }) => {
    // 1. 进入文章创建页面
    await page.goto("/admin/posts/create")
    await expect(page.getByText("创建新文章")).toBeVisible()

    // 2. 填写文章信息
    await page.fill("[data-testid=post-title]", "E2E 测试文章")
    await page.fill("[data-testid=post-excerpt]", "这是 E2E 测试文章的摘要")

    // 3. 填写内容
    const editor = page.locator("[data-testid=markdown-editor] textarea")
    await editor.fill(`
# E2E 测试文章

这是一篇用于 E2E 测试的文章内容。

## 功能列表

- [ ] 创建文章
- [ ] 编辑文章  
- [ ] 发布文章
- [ ] 删除文章

\`\`\`javascript
console.log('Hello, E2E Test!');
\`\`\`
    `)

    // 4. 设置 SEO 信息
    await page.fill("[data-testid=seo-title]", "E2E 测试文章 - SEO 标题")
    await page.fill("[data-testid=seo-description]", "E2E 测试文章的 SEO 描述")

    // 5. 保存为草稿
    await page.click("[data-testid=save-draft]")
    await expect(page.getByText("文章创建成功")).toBeVisible()

    // 6. 验证跳转到文章列表
    await expect(page).toHaveURL("/admin/posts")
    await expect(page.getByText("E2E 测试文章")).toBeVisible()
    await expect(page.getByText("草稿")).toBeVisible()

    // 7. 编辑文章
    await page.click("[data-testid=edit-post]")
    await expect(page).toHaveURL(/\/admin\/posts\/edit\/.+/)

    // 8. 修改标题
    await page.fill("[data-testid=post-title]", "E2E 测试文章（已编辑）")

    // 9. 发布文章
    await page.check("[data-testid=publish-toggle]")
    await page.click("[data-testid=submit-post]")
    await expect(page.getByText("文章更新成功")).toBeVisible()

    // 10. 验证已发布状态
    await expect(page).toHaveURL("/admin/posts")
    await expect(page.getByText("E2E 测试文章（已编辑）")).toBeVisible()
    await expect(page.getByText("已发布")).toBeVisible()

    // 11. 查看前台页面
    await page.goto("/blog")
    await expect(page.getByText("E2E 测试文章（已编辑）")).toBeVisible()

    // 12. 点击进入文章详情
    await page.click("[data-testid=post-link]")
    await expect(page.locator("h1")).toContainText("E2E 测试文章（已编辑）")
    await expect(page.getByText("这是 E2E 测试文章的摘要")).toBeVisible()
  })

  test("应该能处理图片上传", async ({ page }) => {
    await page.goto("/admin/posts/create")

    // 模拟文件上传
    const fileInput = page.locator("input[type=file]")
    await fileInput.setInputFiles("tests/fixtures/test-image.jpg")

    // 等待上传完成
    await expect(page.getByText("图片上传成功")).toBeVisible()

    // 验证编辑器中插入了图片 Markdown
    const editor = page.locator("[data-testid=markdown-editor] textarea")
    const content = await editor.inputValue()
    expect(content).toContain("![test-image.jpg](")
  })

  test("应该能搜索和筛选文章", async ({ page }) => {
    // 创建多篇测试文章（通过 API 或数据库种子）

    await page.goto("/admin/posts")

    // 测试搜索功能
    await page.fill("[data-testid=search-input]", "E2E")
    await page.click("[data-testid=search-button]")

    await expect(page.getByText("E2E 测试文章")).toBeVisible()

    // 测试状态筛选
    await page.selectOption("[data-testid=status-filter]", "published")
    await expect(page.getByText("已发布")).toBeVisible()

    await page.selectOption("[data-testid=status-filter]", "draft")
    await expect(page.getByText("草稿")).toBeVisible()
  })
})
```

### 5.6 性能测试范围

#### 5.6.1 API 性能测试

```typescript
// 文件: tests/performance/posts-performance.test.ts
import { describe, it, expect } from "vitest"
import { performance } from "perf_hooks"
import { createMultiplePosts, getPosts } from "../helpers/performance-helpers"

describe("文章管理性能测试", () => {
  it("应该在合理时间内完成分页查询", async () => {
    // 创建大量测试数据
    await createMultiplePosts(1000)

    const startTime = performance.now()

    const result = await getPosts({
      published: true,
      limit: 20,
    })

    const endTime = performance.now()
    const duration = endTime - startTime

    expect(result.success).toBe(true)
    expect(result.data?.items).toHaveLength(20)
    expect(duration).toBeLessThan(200) // 200ms 内完成
  })

  it("应该高效处理全文搜索", async () => {
    await createMultiplePosts(500)

    const startTime = performance.now()

    const result = await getPosts({
      search: "测试关键词",
      limit: 10,
    })

    const endTime = performance.now()
    const duration = endTime - startTime

    expect(duration).toBeLessThan(300) // 300ms 内完成搜索
  })
})
```

#### 5.6.2 前端性能测试

```typescript
// 文件: tests/performance/editor-performance.spec.ts
import { test, expect } from "@playwright/test"

test.describe("编辑器性能测试", () => {
  test("应该快速加载大文档", async ({ page }) => {
    await page.goto("/admin/posts/create")

    // 生成大型文档内容
    const largeContent = "x".repeat(100000) // 100KB 文本

    const startTime = Date.now()

    const editor = page.locator("[data-testid=markdown-editor] textarea")
    await editor.fill(largeContent)

    const endTime = Date.now()
    const duration = endTime - startTime

    expect(duration).toBeLessThan(1000) // 1秒内完成

    // 验证内容已正确设置
    const content = await editor.inputValue()
    expect(content).toHaveLength(100000)
  })

  test("应该流畅处理实时预览", async ({ page }) => {
    await page.goto("/admin/posts/create")

    const editor = page.locator("[data-testid=markdown-editor] textarea")

    // 测量连续输入的响应时间
    const startTime = Date.now()

    for (let i = 0; i < 100; i++) {
      await editor.type(`第 ${i} 行内容\n`)
    }

    const endTime = Date.now()
    const avgResponseTime = (endTime - startTime) / 100

    expect(avgResponseTime).toBeLessThan(50) // 平均每次输入响应时间 < 50ms
  })
})
```

### 5.7 测试配置文件

#### 5.7.1 Vitest 配置

```typescript
// 文件: vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        ".next/",
        "coverage/",
        "**/*.d.ts",
        "**/*.config.*",
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
})
```

#### 5.7.2 Playwright 配置

```typescript
// 文件: playwright.config.ts
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
```

## 6. 实施路线图

### 6.1 开发时间表

#### Phase 5.1.1: 核心 API 实现 (2-3天)

**Day 1: Server Actions 基础**

- [ ] 创建基础类型定义和验证 Schema
- [ ] 实现 `createPost` 和 `updatePost` 核心功能
- [ ] 实现权限验证中间件
- [ ] 单元测试覆盖核心 API

**Day 2: 查询和状态管理**

- [ ] 实现 `getPosts` 和 `getPost` 查询功能
- [ ] 实现文章状态流转机制
- [ ] 实现 Slug 生成和重复处理
- [ ] 完善单元测试覆盖

**Day 3: 图片上传和标签系统**

- [ ] 集成 Supabase Storage 图片上传
- [ ] 实现标签关联处理逻辑
- [ ] 实现缓存清理机制
- [ ] 集成测试验证

#### Phase 5.1.2: 编辑器和 UI 集成 (2-3天)

**Day 4: Markdown 编辑器**

- [ ] 集成 @uiw/react-md-editor
- [ ] 实现图片拖拽和粘贴上传
- [ ] 实现编辑器工具栏扩展
- [ ] 编辑器组件测试

**Day 5: 表单组件**

- [ ] 创建 PostForm 综合表单组件
- [ ] 集成表单验证和错误处理
- [ ] 实现自动保存功能
- [ ] 表单组件测试

**Day 6: 页面集成**

- [ ] 创建文章创建/编辑页面
- [ ] 创建文章列表管理页面
- [ ] 集成路由和导航
- [ ] UI 集成测试

#### Phase 5.1.3: 测试和优化 (1-2天)

**Day 7: 综合测试**

- [ ] 完善单元测试覆盖率 (>90%)
- [ ] 实施集成测试套件
- [ ] 执行 E2E 测试场景
- [ ] 性能测试和优化

**Day 8: 质量保障**

- [ ] 代码审查和重构
- [ ] 文档更新和完善
- [ ] 部署测试和验证
- [ ] 交付准备

### 6.2 质量门禁

每个 Phase 完成前必须满足以下质量标准：

#### 代码质量门禁

- [ ] 单元测试覆盖率 > 90%
- [ ] 组件测试覆盖率 > 80%
- [ ] 集成测试通过率 100%
- [ ] E2E 测试核心场景通过
- [ ] ESLint 无错误
- [ ] TypeScript 类型检查通过

#### 性能门禁

- [ ] API 响应时间 < 200ms
- [ ] 编辑器初始化 < 100ms
- [ ] 图片上传响应 < 2s
- [ ] 页面加载时间 < 1s
- [ ] Bundle 大小增量 < 200KB

#### 安全门禁

- [ ] 权限验证覆盖所有 API
- [ ] 输入验证和清理到位
- [ ] XSS 防护机制有效
- [ ] 文件上传安全检查
- [ ] 数据库查询参数化

### 6.3 风险缓解计划

#### 🔴 高风险项目

**1. 编辑器性能问题**

- **风险**: 大文档编辑时性能下降
- **缓解**: 实现虚拟滚动和内容分片
- **备选**: 降级到简单 textarea + 预览模式

**2. 图片上传稳定性**

- **风险**: Supabase Storage 上传失败
- **缓解**: 实现重试机制和本地缓存
- **备选**: 使用第三方图床服务

#### 🟡 中风险项目

**1. Slug 冲突处理**

- **风险**: 大量相似标题导致 Slug 冲突
- **缓解**: 改进 Slug 生成算法
- **备选**: 添加时间戳或随机后缀

**2. 权限检查性能**

- **风险**: 每次 API 调用都查询用户权限
- **缓解**: 实现 JWT Token 包含权限信息
- **备选**: Redis 缓存用户权限状态

### 6.4 交付清单

Phase 5.1 完成时应交付以下成果：

#### 核心功能

- [ ] ✅ 完整的文章 CRUD 功能
- [ ] ✅ Markdown 编辑器集成
- [ ] ✅ 图片上传和处理
- [ ] ✅ 权限控制和状态管理
- [ ] ✅ SEO 优化字段支持

#### 技术成果

- [ ] ✅ Server Actions API 层
- [ ] ✅ React 表单和编辑器组件
- [ ] ✅ 类型定义和验证 Schema
- [ ] ✅ 测试套件（单元+集成+E2E）
- [ ] ✅ 性能优化和缓存机制

#### 文档产出

- [ ] ✅ API 文档和使用指南
- [ ] ✅ 组件文档和示例
- [ ] ✅ 部署和运维指南
- [ ] ✅ 测试报告和覆盖率报告

---

## 总结

本设计文档为 Phase
5.1 文章管理系统提供了完整的实施方案，涵盖了从 API 设计到测试策略的全部技术细节。设计方案充分考虑了项目的技术约束、性能要求和安全标准，为后续开发工作提供了明确的技术路线图。

**核心优势**:

1. **完整性**: 覆盖文章管理的所有核心功能
2. **可实施性**: 提供具体的代码示例和实现指导
3. **质量保障**: 定义了全面的测试策略和质量门禁
4. **扩展性**: 为未来功能扩展预留了充足空间

通过遵循本设计文档的技术方案，Phase
5.1 将为整个博客项目奠定坚实的内容管理基础，确保系统的稳定性、性能和可维护性。
