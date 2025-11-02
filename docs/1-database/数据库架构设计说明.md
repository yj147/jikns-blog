# 现代化博客项目数据库架构设计说明

**版本**: 4.1  
**日期**: 2025-08-24  
**编制**: Claude (Based on Requirements v4.0)

## 目录

1. [设计概述](#1-设计概述)
2. [数据模型详解](#2-数据模型详解)
3. [关系设计论证](#3-关系设计论证)
4. [索引策略分析](#4-索引策略分析)
5. [数据完整性与安全性](#5-数据完整性与安全性)
6. [性能优化考量](#6-性能优化考量)
7. [扩展性设计](#7-扩展性设计)

## 1. 设计概述

### 1.1 架构理念

本数据库架构基于"双重核心"设计理念，明确区分**博客模块**（管理员控制）和**动态模块**（多用户社交）两大业务场景。架构采用模块化设计，具备良好的可扩展性和维护性。

### 1.2 核心设计原则

1. **业务分离**: 博客管理和社交互动功能完全分离，各自独立演进
2. **通用化设计**: 评论和点赞系统采用多态关联，支持不同内容类型
3. **权限精细化**: 基于角色和状态的双重权限控制机制
4. **性能导向**: 针对高频查询场景优化索引设计
5. **数据安全**: 级联删除和软删除机制确保数据完整性

### 1.3 模型统计

- **核心模型**: 11个（User, Post, Series, Tag, PostTag, Activity, Comment, Like,
  Bookmark, Follow）
- **枚举类型**: 2个（Role, UserStatus）
- **关系类型**: 一对一(0), 一对多(9), 多对多(3), 多态关联(2)
- **索引数量**: 19个（包含复合索引和唯一约束）

## 2. 数据模型详解

### 2.1 用户系统模块

#### 2.1.1 User 模型

**设计理念**: 作为整个系统的核心模型，User 模型承载了用户身份认证、权限控制和社交关系的全部功能。

**核心字段说明**:

- `id`: 使用 cuid() 生成全局唯一标识符，具备更好的性能和安全性
- `email`: 用户唯一标识，支持 OAuth 和传统认证
- `name`: 可空设计支持 OAuth 注册流程中的延迟信息完善
- `socialLinks`: JSON 格式存储多种社交链接，提供灵活性
- `role`: 枚举类型实现精准权限控制
- `status`: 支持用户封禁功能，满足内容治理需求
- `passwordHash`: 可空设计兼容 OAuth 用户
- `lastLoginAt`: 支持用户活跃度分析和安全审计

**权限设计逻辑**:

```typescript
// 权限检查示例逻辑
function checkBlogPermission(user: User): boolean {
  return user.role === "ADMIN" && user.status === "ACTIVE"
}

function checkInteractionPermission(user: User): boolean {
  return user.status === "ACTIVE" // 不区分角色，所有活跃用户均可互动
}
```

#### 2.1.2 枚举类型设计

```prisma
enum Role {
  USER    // 普通用户：可发布动态、评论、点赞、关注
  ADMIN   // 管理员：拥有全部权限，可管理博客内容和用户
}

enum UserStatus {
  ACTIVE  // 活跃：可正常使用所有功能
  BANNED  // 封禁：无法进行互动操作，仅可查看内容
}
```

**设计优势**:

- 类型安全：TypeScript 原生支持，减少运行时错误
- 扩展性：可轻松添加新角色（如 MODERATOR）或状态（如 SUSPENDED）
- 查询效率：数据库层面的枚举类型提供最佳性能

### 2.2 博客模块

#### 2.2.1 Post 模型

**设计理念**: 面向专业内容创作的长文章模型，强调 SEO 优化和内容管理功能。

**SEO 优化字段**:

- `slug`: URL 友好的唯一标识符，支持自定义和自动生成
- `canonicalUrl`: 防止重复内容的SEO问题
- `seoTitle`/`seoDescription`: 独立的SEO元数据，不影响用户展示内容
- `excerpt`: 文章摘要，用于社交分享和搜索结果
- `publishedAt`: 独立的发布时间，支持定时发布功能

**发布控制逻辑**:

```typescript
interface PublishState {
  published: boolean // 是否公开可见
  publishedAt: Date? // 实际发布时间
  isPinned: boolean // 是否置顶显示
}
```

#### 2.2.2 Series 模型

**设计理念**: 将相关文章组织成系列，提升内容结构化程度和用户阅读体验。

**核心功能**:

- 支持多个文章组成逻辑系列
- 独立的系列封面和描述
- 排序权重控制系列展示顺序
- 软删除设计：删除系列时文章不受影响

#### 2.2.3 Tag 模型 & PostTag 关联表

**设计理念**: 实现灵活的内容分类和标签云功能。

**多对多关系实现**:

```prisma
// 显式关联表设计
model PostTag {
  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId    String
  tag       Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId     String
  createdAt DateTime  @default(now())

  @@id([postId, tagId])
}
```

**优势分析**:

- 支持标签使用统计（postsCount 字段）
- 可扩展标签元数据（颜色、描述等）
- 审计时间戳追踪标签添加历史

### 2.3 社交动态模块

#### 2.3.1 Activity 模型

**设计理念**: 轻量级短内容发布，支持图文混合和快速互动。

**核心特性**:

- `content`: 支持长文本，兼容富文本内容
- `imageUrls`: JSON 数组存储多图片，提供展示灵活性
- `isPinned`: 用户个人主页置顶功能
- 简化的发布流程：无需审核，即发即显

**与 Post 模型的对比**: | 特性 | Post (博客) | Activity (动态) |
|------|-------------|----------------| | 内容长度 | 长文章 | 短内容 |
| 发布权限 | 仅管理员 | 所有用户 | | SEO优化 | 完整支持 | 不支持 |
| 内容结构 | 结构化 | 自由格式 | | 审核机制 | 发布前 | 发布后 |

### 2.4 通用交互模块

#### 2.4.1 Comment 模型（多态设计）

**设计理念**: 统一的评论系统，支持文章和动态的评论，以及嵌套回复功能。

**多态关联实现**:

```prisma
model Comment {
  // 多态字段：评论目标
  postId     String?
  activityId String?
  post       Post?     @relation(fields: [postId], references: [id], onDelete: Cascade)
  activity   Activity? @relation(fields: [activityId], references: [id], onDelete: Cascade)

  // 嵌套回复
  parent     Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: NoAction)
  parentId   String?
  replies    Comment[] @relation("CommentReplies")
}
```

**嵌套回复设计考量**:

- 使用自引用关系实现任意深度回复
- `onDelete: NoAction` 防止删除父评论时误删子评论
- 支持评论楼层的灵活展示和折叠

#### 2.4.2 Like 模型（多态设计）

**设计理念**: 轻量级点赞系统，支持文章和动态的点赞功能。

**防重复点赞机制**:

```prisma
model Like {
  @@unique([authorId, postId])     // 防止重复点赞文章
  @@unique([authorId, activityId]) // 防止重复点赞动态
}
```

**查询优化设计**:

- 复合唯一约束确保数据一致性
- 多个索引支持不同维度的高效查询
- 轻量级模型设计，最小化存储开销

### 2.5 用户功能模块

#### 2.5.1 Bookmark 模型

**设计理念**: 用户文章收藏功能，支持个人内容管理。

**核心特性**:

- 仅支持文章收藏（动态不支持收藏）
- 唯一约束防止重复收藏
- 级联删除确保数据一致性

#### 2.5.2 Follow 模型

**设计理念**: 用户关注关系，构建社交网络基础。

**关系设计**:

```prisma
model Follow {
  followerId  String   // 关注者
  followingId String   // 被关注者

  // 双向关联设计
  follower    User     @relation("Follower", fields: [followerId], references: [id])
  following   User     @relation("Following", fields: [followingId], references: [id])

  @@id([followerId, followingId]) // 复合主键
}
```

**关系图示**:

```
User A follows User B:
- A.following[] 包含 B
- B.followers[] 包含 A
```

## 3. 关系设计论证

### 3.1 一对多关系

#### 3.1.1 User → Posts

**业务逻辑**: 管理员可发布多篇博客文章，每篇文章只有一个作者。

```prisma
User {
  posts Post[] // 一个用户的多篇文章
}
Post {
  author   User   @relation(fields: [authorId], references: [id])
  authorId String // 外键引用
}
```

#### 3.1.2 User → Activities

**业务逻辑**: 用户可发布多条动态，每条动态只有一个作者。

```prisma
User {
  activities Activity[]
}
Activity {
  author   User   @relation(fields: [authorId], references: [id])
  authorId String
}
```

#### 3.1.3 Post → Comments

**业务逻辑**: 文章可有多条评论，每条评论属于一篇文章。

```prisma
Post {
  comments Comment[]
}
Comment {
  post   Post?  @relation(fields: [postId], references: [id])
  postId String?
}
```

### 3.2 多对多关系

#### 3.2.1 Post ↔ Tags

**业务逻辑**: 一篇文章可有多个标签，一个标签可用于多篇文章。

```prisma
// 通过显式中间表实现
PostTag {
  post   Post @relation(fields: [postId], references: [id])
  tag    Tag  @relation(fields: [tagId], references: [id])
  @@id([postId, tagId])
}
```

**优势**:

- 支持标签统计：`SELECT tagId, COUNT(*) FROM PostTag GROUP BY tagId`
- 可扩展中间表字段（如标签权重、添加时间）
- 更好的查询性能和数据完整性

#### 3.2.2 User ↔ User (Follow)

**业务逻辑**: 用户之间的多对多关注关系。

```prisma
Follow {
  followerId  String
  followingId String
  @@id([followerId, followingId])
}
```

**关系查询示例**:

```typescript
// 查询用户A的所有关注者
const followers = await prisma.follow.findMany({
  where: { followingId: userA.id },
  include: { follower: true },
})

// 查询用户A关注的所有人
const following = await prisma.follow.findMany({
  where: { followerId: userA.id },
  include: { following: true },
})
```

### 3.3 多态关联设计

#### 3.3.1 Comment 多态关联

**设计目标**: 统一评论系统支持文章和动态评论。

```prisma
model Comment {
  // 多态字段
  postId     String?   // 文章评论
  activityId String?   // 动态评论

  // 关联关系
  post       Post?     @relation(fields: [postId], references: [id])
  activity   Activity? @relation(fields: [activityId], references: [id])
}
```

**业务约束**:

- 每条评论必须且只能属于一个目标（postId XOR activityId）
- 应用层需添加校验逻辑确保数据一致性

**查询优化**:

```typescript
// 应用层联合查询
const commentsWithTarget = await prisma.comment.findMany({
  where: {
    OR: [{ postId: targetId }, { activityId: targetId }],
  },
  include: {
    author: true,
    post: true,
    activity: true,
  },
})
```

#### 3.3.2 Like 多态关联

**设计理念**: 与 Comment 相同的多态设计，支持文章和动态点赞。

**唯一性约束**:

```prisma
model Like {
  @@unique([authorId, postId])     // 用户对文章只能点赞一次
  @@unique([authorId, activityId]) // 用户对动态只能点赞一次
}
```

**业务逻辑验证**:

```typescript
// 点赞前检查
const existingLike = await prisma.like.findFirst({
  where: {
    authorId: userId,
    OR: [
      { postId: targetType === "post" ? targetId : undefined },
      { activityId: targetType === "activity" ? targetId : undefined },
    ],
  },
})
```

## 4. 索引策略分析

### 4.1 主键和外键索引

所有模型的主键（`@id`）和外键关联字段自动创建索引，为基础查询提供最佳性能。

### 4.2 复合索引设计

#### 4.2.1 文章发布索引

```prisma
@@index([published, publishedAt(sort: Desc)])
```

**查询场景**: 获取已发布文章列表，按发布时间倒序

```sql
SELECT * FROM posts WHERE published = true ORDER BY publishedAt DESC LIMIT 10;
```

#### 4.2.2 时间序列索引

```prisma
// Activity模型
@@index([createdAt(sort: Desc)])
// Comment模型
@@index([createdAt(sort: Desc)])
```

**查询场景**: 信息流按时间排序，评论按时间排序

```sql
SELECT * FROM activities ORDER BY createdAt DESC LIMIT 20;
```

#### 4.2.3 标签频率索引

```prisma
@@index([postsCount(sort: Desc)])
```

**查询场景**: 标签云展示，按使用频率排序

```sql
SELECT * FROM tags ORDER BY postsCount DESC LIMIT 50;
```

### 4.3 查询性能分析

#### 4.3.1 高频查询场景

1. **博客文章列表**: `published + publishedAt` 复合索引
2. **用户动态流**: `createdAt` 降序索引
3. **用户关注列表**: `followerId/followingId` 索引
4. **评论查询**: `postId/activityId` 索引
5. **点赞统计**: `postId/activityId` 索引

#### 4.3.2 索引选择性分析

```sql
-- 高选择性索引（推荐）
email (唯一值)
slug (唯一值)
[authorId, postId] (复合唯一)

-- 中等选择性索引（有效）
createdAt (时间分布)
published (boolean，但结合其他字段有效)

-- 低选择性索引（避免）
role (只有两个值)
status (只有两个值)
```

### 4.4 索引维护成本

**写入性能影响**:

- 每个索引增加 INSERT/UPDATE/DELETE 成本
- 当前设计19个索引，属于合理范围
- 重点优化高频查询，避免过度索引

**存储空间成本**:

- 复合索引空间占用较大，但查询收益明显
- 单列索引空间占用较小，维护成本低
- 定期分析索引使用率，清理无效索引

## 5. 数据完整性与安全性

### 5.1 引用完整性

#### 5.1.1 级联删除策略

```prisma
// 用户删除时级联删除其内容
author User @relation(fields: [authorId], references: [id], onDelete: Cascade)

// 文章删除时级联删除其评论和点赞
post Post @relation(fields: [postId], references: [id], onDelete: Cascade)

// 系列删除时保留文章（设置为null）
series Series? @relation(fields: [seriesId], references: [id], onDelete: SetNull)
```

#### 5.1.2 特殊处理：评论嵌套回复

```prisma
parent Comment? @relation("CommentReplies", fields: [parentId], references: [id], onDelete: NoAction)
```

**设计理念**: 父评论删除时不自动删除回复，避免误删有价值的讨论内容。

**应用层处理逻辑**:

```typescript
async function deleteComment(commentId: string) {
  // 1. 检查是否有子回复
  const replies = await prisma.comment.count({
    where: { parentId: commentId },
  })

  if (replies > 0) {
    // 2. 有子回复时软删除（标记为已删除）
    await prisma.comment.update({
      where: { id: commentId },
      data: { content: "[此评论已删除]", authorId: null },
    })
  } else {
    // 3. 无子回复时直接物理删除
    await prisma.comment.delete({
      where: { id: commentId },
    })
  }
}
```

### 5.2 唯一性约束

#### 5.2.1 业务唯一性

```prisma
// 用户邮箱唯一
email String @unique

// 文章和系列slug唯一
slug String @unique

// 标签名称唯一
name String @unique
```

#### 5.2.2 复合唯一性

```prisma
// 防止重复点赞
@@unique([authorId, postId])
@@unique([authorId, activityId])

// 防止重复收藏
@@unique([userId, postId])

// 防止重复关注
@@id([followerId, followingId]) // 复合主键即唯一约束
```

### 5.3 数据验证

#### 5.3.1 应用层验证规则

```typescript
// 用户输入验证
const UserCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  socialLinks: z.record(z.string().url()).optional(),
})

// 内容长度限制
const PostCreateSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
})
```

#### 5.3.2 权限验证

```typescript
// 权限检查中间件
async function requireAuth(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user || user.status === "BANNED") {
    throw new Error("Unauthorized")
  }

  return user
}

async function requireAdmin(userId: string) {
  const user = await requireAuth(userId)

  if (user.role !== "ADMIN") {
    throw new Error("Admin required")
  }

  return user
}
```

### 5.4 安全考量

#### 5.4.1 敏感数据保护

- 密码使用哈希存储（bcrypt/argon2）
- 不存储明文敏感信息
- 用户删除时考虑GDPR合规

#### 5.4.2 SQL注入防护

- Prisma提供原生防护
- 参数化查询避免字符串拼接
- 输入验证和清理

#### 5.4.3 访问控制

```typescript
// Row-level security example
async function getUserPosts(userId: string, viewerId: string) {
  return prisma.post.findMany({
    where: {
      authorId: userId,
      // 只能查看已发布的文章，除非是作者本人
      OR: [
        { published: true },
        { authorId: viewerId }, // 作者可以查看自己的草稿
      ],
    },
  })
}
```

## 6. 性能优化考量

### 6.1 查询优化策略

#### 6.1.1 N+1 查询问题解决

```typescript
// 错误方式：N+1查询
const posts = await prisma.post.findMany()
for (const post of posts) {
  const author = await prisma.user.findUnique({ where: { id: post.authorId } })
}

// 正确方式：使用include
const posts = await prisma.post.findMany({
  include: {
    author: true,
    tags: { include: { tag: true } },
    _count: { select: { comments: true, likes: true } },
  },
})
```

#### 6.1.2 分页查询优化

```typescript
// 基于游标的高效分页
async function getPaginatedPosts(cursor?: string, limit: number = 10) {
  return prisma.post.findMany({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      author: { select: { name: true, avatarUrl: true } },
      _count: { select: { comments: true, likes: true } },
    },
  })
}
```

### 6.2 缓存策略

#### 6.2.1 应用层缓存

```typescript
// Redis缓存热门文章
async function getPopularPosts() {
  const cacheKey = "popular_posts"
  const cached = await redis.get(cacheKey)

  if (cached) {
    return JSON.parse(cached)
  }

  const posts = await prisma.post.findMany({
    where: { published: true },
    orderBy: { viewCount: "desc" },
    take: 10,
    include: { author: true },
  })

  await redis.setex(cacheKey, 3600, JSON.stringify(posts)) // 1小时缓存
  return posts
}
```

#### 6.2.2 数据库查询缓存

```typescript
// 标签云缓存
async function getTagCloud() {
  const cacheKey = "tag_cloud"
  const cached = await redis.get(cacheKey)

  if (cached) return JSON.parse(cached)

  const tags = await prisma.tag.findMany({
    where: { postsCount: { gt: 0 } },
    orderBy: { postsCount: "desc" },
    take: 50,
  })

  await redis.setex(cacheKey, 7200, JSON.stringify(tags)) // 2小时缓存
  return tags
}
```

### 6.3 数据库优化

#### 6.3.1 连接池配置

```typescript
// Prisma连接池优化
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  // 连接池配置
  // connectionPoolTimeout: 20000,
  // connectionPoolSize: 10
})
```

#### 6.3.2 批量操作优化

```typescript
// 批量创建标签关联
async function createPostTags(postId: string, tagNames: string[]) {
  // 先批量查询/创建标签
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where: { name },
        create: { name, slug: slugify(name) },
        update: {},
      })
    )
  )

  // 再批量创建关联
  const postTags = tags.map((tag) => ({
    postId,
    tagId: tag.id,
  }))

  await prisma.postTag.createMany({
    data: postTags,
    skipDuplicates: true,
  })
}
```

### 6.4 监控和优化

#### 6.4.1 慢查询监控

```typescript
// Prisma中间件监控慢查询
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()

  const queryTime = after - before
  if (queryTime > 1000) {
    // 超过1秒的查询
    console.warn(
      `Slow query detected: ${params.model}.${params.action} took ${queryTime}ms`
    )
  }

  return result
})
```

#### 6.4.2 性能分析

```sql
-- PostgreSQL查询计划分析
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM posts
WHERE published = true
ORDER BY publishedAt DESC
LIMIT 10;

-- 索引使用情况查询
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan < 100; -- 查找很少使用的索引
```

## 7. 扩展性设计

### 7.1 功能扩展预留

#### 7.1.1 通知系统预留

```prisma
// 未来扩展：通知模型
model Notification {
  id         String   @id @default(cuid())
  type       NotificationType // 评论通知、点赞通知、@提及等
  content    String
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())

  // 接收者
  userId     String
  user       User     @relation(fields: [userId], references: [id])

  // 关联的内容（多态）
  postId     String?
  activityId String?
  commentId  String?
}
```

#### 7.1.2 邮件订阅预留

```prisma
// 未来扩展：订阅模型
model Subscription {
  id         String   @id @default(cuid())
  email      String
  active     Boolean  @default(true)
  createdAt  DateTime @default(now())

  @@unique([email])
}
```

#### 7.1.3 内容审核预留

```prisma
// 未来扩展：审核记录
model ModerationLog {
  id         String   @id @default(cuid())
  action     String   // 'approve', 'reject', 'delete'
  reason     String?
  createdAt  DateTime @default(now())

  // 审核员
  moderatorId String
  moderator   User    @relation(fields: [moderatorId], references: [id])

  // 被审核内容（多态）
  postId     String?
  activityId String?
  commentId  String?
}
```

### 7.2 性能扩展路径

#### 7.2.1 读写分离准备

```typescript
// 主从数据库配置预留
const prismaWrite = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_WRITE_URL } },
})

const prismaRead = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_READ_URL } },
})

// 查询路由
export const db = {
  // 写操作使用主库
  create: prismaWrite,
  update: prismaWrite,
  delete: prismaWrite,

  // 读操作使用从库
  read: prismaRead,
}
```

#### 7.2.2 分库分表准备

```typescript
// 用户分表策略预留
function getUserShardId(userId: string): number {
  return parseInt(userId.slice(-1), 16) % 4 // 16进制最后一位分4个片
}

// 内容分表策略预留
function getContentShardId(contentId: string): number {
  return parseInt(contentId.slice(-2), 16) % 8 // 16进制最后两位分8个片
}
```

#### 7.2.3 缓存层扩展

```typescript
// 多级缓存架构预留
interface CacheLayer {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  del(key: string): Promise<void>
}

class MultiLevelCache {
  constructor(
    private l1: CacheLayer, // 本地缓存（Redis）
    private l2: CacheLayer // 远程缓存（Memcached）
  ) {}

  async get(key: string): Promise<string | null> {
    // L1 缓存命中
    let value = await this.l1.get(key)
    if (value) return value

    // L2 缓存命中，回填L1
    value = await this.l2.get(key)
    if (value) {
      await this.l1.set(key, value, 300) // L1缓存5分钟
      return value
    }

    return null
  }
}
```

### 7.3 数据迁移策略

#### 7.3.1 模式演进

```typescript
// 数据库迁移脚本示例
async function migrateAddTagColor() {
  // 1. 添加新列（可空）
  await prisma.$executeRaw`ALTER TABLE tags ADD COLUMN color VARCHAR(7)`

  // 2. 为现有数据设置默认值
  await prisma.$executeRaw`UPDATE tags SET color = '#3B82F6' WHERE color IS NULL`

  // 3. 可选：添加约束
  await prisma.$executeRaw`ALTER TABLE tags ALTER COLUMN color SET NOT NULL`
}
```

#### 7.3.2 零停机部署

```typescript
// 蓝绿部署兼容性检查
async function checkSchemaCompatibility(oldSchema: string, newSchema: string) {
  const compatibility = {
    canDeploy: true,
    warnings: [] as string[],
    breaking: [] as string[],
  }

  // 检查不兼容变更
  // 1. 删除列
  // 2. 修改列类型
  // 3. 添加非空约束
  // ...

  return compatibility
}
```

### 7.4 监控和观察性

#### 7.4.1 业务指标监控

```typescript
// 关键业务指标
const businessMetrics = {
  // 内容指标
  postsPublished: () => prisma.post.count({ where: { published: true } }),
  activitiesPosted: () => prisma.activity.count(),
  commentsPosted: () => prisma.comment.count(),

  // 用户指标
  activeUsers: () => prisma.user.count({ where: { status: "ACTIVE" } }),
  newSignups: (days: number) =>
    prisma.user.count({
      where: {
        createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
      },
    }),

  // 互动指标
  likesGiven: () => prisma.like.count(),
  followRelations: () => prisma.follow.count(),
}
```

#### 7.4.2 技术指标监控

```typescript
// 数据库性能监控
async function getDatabaseMetrics() {
  const [connectionCount, slowQueries, indexUsage] = await Promise.all([
    prisma.$queryRaw`SELECT count(*) FROM pg_stat_activity`,
    prisma.$queryRaw`SELECT query, calls, total_time FROM pg_stat_statements WHERE total_time > 1000 ORDER BY total_time DESC LIMIT 10`,
    prisma.$queryRaw`SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan < 100`,
  ])

  return { connectionCount, slowQueries, indexUsage }
}
```

## 总结

本数据库架构设计充分考虑了现代化博客项目的双重核心需求，通过模块化设计实现了博客管理和社交互动功能的有效分离。架构具备以下核心优势：

1. **业务契合度高**: 精确映射项目需求的11个核心模型
2. **性能优化完善**: 19个精心设计的索引覆盖高频查询场景
3. **扩展性优秀**: 为通知系统、邮件订阅等未来功能预留扩展空间
4. **安全性可靠**: 完善的权限控制和数据完整性保障
5. **可维护性强**: 清晰的模型关系和充分的文档说明

通过遵循Schema
First原则和本地开发优先的工作流程，该架构为项目的快速迭代和长期演进奠定了坚实基础。
