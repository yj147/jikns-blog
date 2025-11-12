# Phase 6 动态发布系统 - 系统设计文档

**版本**: 1.0  
**生成时间**: 2025-08-31 14:45:00  
**项目阶段**: Phase 6 - Activity System Design  
**设计范围**: API契约、数据模型、权限体系、图片上传、前端架构、性能基线

---

## 目录

1. [系统概述](#1-系统概述)
2. [API契约设计](#2-api契约设计)
3. [数据模型与索引优化](#3-数据模型与索引优化)
4. [权限与可见性设计](#4-权限与可见性设计)
5. [图片上传策略](#5-图片上传策略)
6. [前端组件架构](#6-前端组件架构)
7. [性能基线与测试策略](#7-性能基线与测试策略)
8. [实施路线图](#8-实施路线图)

---

## 1. 系统概述

### 1.1 业务定位

动态(Activity)发布系统是平台的**社交核心**，为所有注册用户提供即时内容分享和互动能力。与管理员专属的博客系统形成互补，构建完整的内容生态。

### 1.2 核心功能

- **内容发布**: 支持文本 + 多图的富媒体动态
- **信息流展示**: 时间线形式的动态流，支持多种排序
- **个人主页**: 用户动态聚合，支持置顶功能
- **权限控制**: 基于用户状态的精细化权限管理

### 1.3 技术选型

| 层级       | 技术方案            | 选择理由                          |
| ---------- | ------------------- | --------------------------------- |
| **API层**  | Next.js API Routes  | HTTP缓存、RESTful标准、第三方友好 |
| **数据层** | Prisma + PostgreSQL | 类型安全、关系型数据、索引优化    |
| **存储层** | Supabase Storage    | 集成简单、CDN加速、成本可控       |
| **前端层** | React + SWR         | 服务器状态管理、乐观UI、缓存优化  |
| **认证层** | 复用Phase 1-4成果   | 成熟稳定、已验证的三层权限架构    |

### 1.4 设计原则

1. **用户体验优先**: 乐观UI更新，秒级响应
2. **渐进增强**: 基础功能先行，逐步添加高级特性
3. **性能导向**: 缓存策略、懒加载、分页优化
4. **安全第一**: XSS防护、权限验证、内容审核

---

## 2. API契约设计

### 2.1 RESTful API 端点

#### 2.1.1 动态CRUD操作

```typescript
// 创建动态
POST /api/activities
Request: {
  content: string         // 动态内容，必填，最大5000字符
  imageUrls?: string[]    // 图片URLs，可选，最多9张
  isPinned?: boolean      // 是否置顶，默认false
}
Response: {
  success: boolean
  data?: {
    id: string
    content: string
    imageUrls: string[]
    isPinned: boolean
    author: {
      id: string
      name: string
      avatarUrl: string
      verified: boolean
    }
    createdAt: string
    updatedAt: string
    _count: {
      comments: number
      likes: number
    }
  }
  error?: ApiError
}

// 获取动态列表（信息流）
GET /api/activities
Query Parameters:
  - page: number (默认1)
  - limit: number (默认20，最大50)
  - orderBy: 'latest' | 'trending' | 'following' (默认latest)
  - authorId?: string (筛选特定用户)
  - cursor?: string (游标分页，使用 activity id)
  - isPinned?: boolean (true 表示仅置顶动态，false 表示仅普通动态)
  - hasImages?: boolean (true 表示仅含图动态，false 表示仅纯文本)

Response: {
  success: boolean
  data?: Activity[]
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
      hasMore: boolean
      nextCursor?: string // Activity ID Cursor
    }
  }
}

// 获取单个动态
GET /api/activities/[id]
Response: {
  success: boolean
  data?: Activity & {
    author: User
    _count: {
      comments: number
      likes: number
    }
    isLiked?: boolean  // 当前用户是否点赞
    canEdit: boolean   // 当前用户是否可编辑
    canDelete: boolean // 当前用户是否可删除
  }
}

// 更新动态
PUT /api/activities/[id]
Request: {
  content?: string
  isPinned?: boolean
}
Response: {
  success: boolean
  data?: Activity
}

// 删除动态
DELETE /api/activities/[id]
Response: {
  success: boolean
  data?: { deletedAt: string }
}
```

#### 2.1.2 用户动态相关

```typescript
// 获取用户的动态列表
GET /api/users/[userId]/activities
Query Parameters:
  - page: number
  - limit: number
  - includePinned: boolean (是否包含置顶)

// 获取用户的动态统计
GET /api/users/[userId]/activities/stats
Response: {
  total: number
  todayCount: number
  weekCount: number
  monthCount: number
}
```

### 2.2 错误码规范

```typescript
enum ActivityErrorCode {
  // 400 级别
  CONTENT_REQUIRED = "ACTIVITY_CONTENT_REQUIRED",
  CONTENT_TOO_LONG = "ACTIVITY_CONTENT_TOO_LONG",
  TOO_MANY_IMAGES = "ACTIVITY_TOO_MANY_IMAGES",

  // 401 级别
  AUTH_REQUIRED = "ACTIVITY_AUTH_REQUIRED",

  // 403 级别
  USER_BANNED = "ACTIVITY_USER_BANNED",
  PERMISSION_DENIED = "ACTIVITY_PERMISSION_DENIED",

  // 404 级别
  NOT_FOUND = "ACTIVITY_NOT_FOUND",

  // 429 级别
  RATE_LIMIT = "ACTIVITY_RATE_LIMIT",

  // 500 级别
  INTERNAL_ERROR = "ACTIVITY_INTERNAL_ERROR",
}
```

### 2.3 速率限制

```typescript
const rateLimits = {
  create: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 10, // 最多10条动态
  },
  read: {
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 100, // 最多100次请求
  },
  update: {
    windowMs: 5 * 60 * 1000, // 5分钟
    max: 20, // 最多20次更新
  },
}
```

### 2.4 限流基础设施（Phase 6 更新）

- 生产环境默认接入 Upstash/Redis，通过 `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN`
  建立集中式计数；本地或单实例环境下自动回退到进程内内存。
- 所有 `rateLimitCheck` 调用都会记录 `MetricType.ACTIVITY_RATE_LIMIT_CHECK`
  指标，沉淀到 `performanceMonitor`，供监控面板与脚本消费。
- 限流监控字段：总检查次数、拦截次数、拦截率、按操作类型拆解的拦截率与剩余额度均值；脚本
  `collect-monitoring-data.sh` 会在日报中输出 `Activity 限流指标` 区块。
- 提供 `resetUserRateLimit`
  对应 Redis 删除（按类型枚举 key），保持管理员工具行为不变。
- 新增 `MetricType.ACTIVITY_SEARCH_DURATION`
  指标，记录服务端搜索耗时与结果数量，`collect-monitoring-data.sh`
  报告中呈现“Activity 搜索指标”。

---

## 3. 数据模型与索引优化

### 3.1 Activity 模型增强

```prisma
model Activity {
  // 基础字段
  id        String   @id @default(cuid())
  content   String   @db.Text
  imageUrls Json?    // ["url1", "url2", ...] 最多9张

  // 控制字段
  isPinned  Boolean  @default(false)
  isDeleted Boolean  @default(false)  // 软删除标记

  // 审计字段
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  // 统计字段（冗余缓存）
  likesCount    Int @default(0)
  commentsCount Int @default(0)
  viewsCount    Int @default(0)

  // 作者关联
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId String

  // 关联关系
  comments Comment[]
  likes    Like[]

  // 复合索引优化
  @@index([authorId, createdAt(sort: Desc)])    // 用户动态查询
  @@index([createdAt(sort: Desc)])               // 时间线查询
  @@index([isPinned, createdAt(sort: Desc)])     // 置顶+时间排序
  @@index([isDeleted, createdAt(sort: Desc)])    // 软删除过滤
  @@map("activities")
}
```

### 3.2 数据库迁移策略

```sql
-- 添加统计字段和软删除
ALTER TABLE activities
ADD COLUMN likes_count INTEGER DEFAULT 0,
ADD COLUMN comments_count INTEGER DEFAULT 0,
ADD COLUMN views_count INTEGER DEFAULT 0,
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN deleted_at TIMESTAMP;

-- 创建优化索引
CREATE INDEX idx_activities_timeline
ON activities(created_at DESC)
WHERE is_deleted = FALSE;

CREATE INDEX idx_activities_user_timeline
ON activities(author_id, created_at DESC)
WHERE is_deleted = FALSE;

CREATE INDEX idx_activities_pinned
ON activities(is_pinned, created_at DESC)
WHERE is_deleted = FALSE AND is_pinned = TRUE;
```

### 3.3 查询优化策略

```typescript
// 使用游标分页替代偏移分页
const activities = await prisma.activity.findMany({
  where: {
    isDeleted: false,
    ...(cursor && {
      createdAt: {
        lt: cursor,
      },
    }),
  },
  include: {
    author: {
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    },
    _count: {
      select: {
        comments: true,
        likes: true,
      },
    },
  },
  orderBy: {
    createdAt: "desc",
  },
  take: limit + 1, // 多取一条判断是否有下一页
})
```

---

## 4. 权限与可见性设计

### 4.1 权限矩阵

| 操作     | 未登录 | BANNED用户 | ACTIVE用户 | 作者本人 | ADMIN |
| -------- | ------ | ---------- | ---------- | -------- | ----- |
| 查看动态 | ✅     | ✅         | ✅         | ✅       | ✅    |
| 发布动态 | ❌     | ❌         | ✅         | ✅       | ✅    |
| 编辑动态 | ❌     | ❌         | ❌         | ✅       | ✅    |
| 删除动态 | ❌     | ❌         | ❌         | ✅       | ✅    |
| 置顶动态 | ❌     | ❌         | ❌         | ✅       | ✅    |
| 点赞动态 | ❌     | ❌         | ✅         | ✅       | ✅    |
| 评论动态 | ❌     | ❌         | ✅         | ✅       | ✅    |

### 4.2 权限验证实现

```typescript
// lib/permissions/activity.ts
export class ActivityPermissions {
  static async canCreate(user: User | null): Promise<boolean> {
    if (!user) return false
    return user.status === "ACTIVE"
  }

  static async canUpdate(
    user: User | null,
    activity: Activity
  ): Promise<boolean> {
    if (!user) return false
    if (user.role === "ADMIN") return true
    return user.id === activity.authorId
  }

  static async canDelete(
    user: User | null,
    activity: Activity
  ): Promise<boolean> {
    if (!user) return false
    if (user.role === "ADMIN") return true
    return user.id === activity.authorId
  }

  static async canPin(user: User | null, activity: Activity): Promise<boolean> {
    if (!user) return false
    return user.id === activity.authorId
  }
}

// API中使用
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth(request)
  const activity = await prisma.activity.findUnique({
    where: { id: params.id },
  })

  if (!activity || activity.isDeleted) {
    return createErrorResponse("NOT_FOUND", "动态不存在")
  }

  if (!(await ActivityPermissions.canUpdate(user, activity))) {
    return createErrorResponse("PERMISSION_DENIED", "无权限编辑此动态")
  }

  // 执行更新...
}
```

### 4.3 可见性规则

```typescript
// 信息流可见性过滤
interface VisibilityFilter {
  isDeleted: false // 排除已删除
  OR?: [
    { author: { status: "ACTIVE" } }, // 活跃用户的动态
    { author: { status: "BANNED"; role: "ADMIN" } }, // 被封禁的管理员动态仍可见
  ]
}

// 不同场景的可见性
const visibilityScopes = {
  public: {
    isDeleted: false,
  },
  userProfile: (userId: string) => ({
    isDeleted: false,
    authorId: userId,
  }),
  following: (followingIds: string[]) => ({
    isDeleted: false,
    authorId: { in: followingIds },
  }),
}
```

---

## 5. 图片上传策略

### 5.1 多图上传架构

```typescript
// 上传配置
const uploadConfig = {
  maxFiles: 9, // 最多9张图片
  maxSizePerFile: 10 * 1024 * 1024, // 单张10MB
  maxTotalSize: 50 * 1024 * 1024, // 总计50MB
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  dimensions: {
    maxWidth: 4096,
    maxHeight: 4096,
    thumbnailWidth: 400,
    thumbnailHeight: 400,
  },
}
```

### 5.2 批量上传API

```typescript
// POST /api/upload/images
export async function POST(request: NextRequest) {
  const user = await requireAuth(request)
  if (user.status !== "ACTIVE") {
    return createErrorResponse("USER_BANNED", "用户状态异常")
  }

  const formData = await request.formData()
  const files = formData.getAll("files") as File[]

  // 验证文件数量
  if (files.length > uploadConfig.maxFiles) {
    return createErrorResponse(
      "TOO_MANY_FILES",
      `最多上传${uploadConfig.maxFiles}张图片`
    )
  }

  // 并行上传
  const uploadPromises = files.map(async (file, index) => {
    try {
      // 验证文件
      const validation = validateImageFile(file)
      if (!validation.isValid) {
        throw new Error(validation.error)
      }

      // 生成存储路径
      const fileName = generateFileName(file, index)
      const path = `activities/${user.id}/${Date.now()}/${fileName}`

      // 上传到Supabase
      const { data, error } = await supabase.storage
        .from("activity-images")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        })

      if (error) throw error

      // 获取公开URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("activity-images").getPublicUrl(path)

      return {
        success: true,
        url: publicUrl,
        index,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        index,
      }
    }
  })

  const results = await Promise.all(uploadPromises)

  // 分离成功和失败的结果
  const successful = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)

  return NextResponse.json({
    success: true,
    data: {
      urls: successful.map((r) => r.url),
      failed: failed.map((r) => ({
        index: r.index,
        error: r.error,
      })),
    },
  })
}
```

### 5.3 前端上传组件

```typescript
// components/activity/image-upload-grid.tsx
interface ImageUploadGridProps {
  maxImages?: number
  onUpload: (urls: string[]) => void
  onError?: (errors: UploadError[]) => void
}

export function ImageUploadGrid({
  maxImages = 9,
  onUpload,
  onError
}: ImageUploadGridProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<number, number>>({})

  const handleUpload = async () => {
    setUploading(true)

    const formData = new FormData()
    files.forEach(file => formData.append('files', file))

    try {
      const response = await fetch('/api/upload/images', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        onUpload(result.data.urls)
        if (result.data.failed?.length > 0) {
          onError?.(result.data.failed)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* 图片预览网格 */}
      {files.map((file, index) => (
        <ImagePreview
          key={index}
          file={file}
          progress={progress[index]}
          onRemove={() => removeFile(index)}
        />
      ))}

      {/* 添加按钮 */}
      {files.length < maxImages && (
        <AddImageButton
          onAdd={handleFileSelect}
          disabled={uploading}
        />
      )}
    </div>
  )
}
```

### 5.4 图片优化策略

1. **客户端压缩**: 使用 browser-image-compression 库
2. **懒加载**: Intersection Observer API
3. **渐进式加载**: 先显示模糊缩略图，后加载高清图
4. **CDN缓存**: Supabase 自带 CDN 加速
5. **清理策略**: 定期清理未关联的孤立图片

---

## 6. 前端组件架构

### 6.1 目录结构

```
app/
├── feed/
│   ├── page.tsx                    # 主页面（已存在，需优化）
│   ├── layout.tsx                  # 布局（新建）
│   └── loading.tsx                 # 加载状态（新建）
│
components/
├── activity/
│   ├── activity-card.tsx           # 动态卡片（已存在）
│   ├── activity-composer.tsx       # 发布组件（新建）
│   ├── activity-feed.tsx           # 信息流容器（新建）
│   ├── activity-skeleton.tsx       # 骨架屏（新建）
│   ├── image-upload-grid.tsx       # 多图上传（新建）
│   ├── image-viewer.tsx            # 图片查看器（新建）
│   └── feed-filters.tsx            # 筛选器（新建）
│
hooks/
├── use-activities.ts                # 动态数据Hook
├── use-activity-mutations.ts        # 动态操作Hook
└── use-infinite-scroll.ts          # 无限滚动Hook
```

### 6.2 核心组件设计

#### 6.2.1 动态发布组件

```typescript
// components/activity/activity-composer.tsx
interface ActivityComposerProps {
  onSuccess?: (activity: Activity) => void
  onError?: (error: Error) => void
}

export function ActivityComposer({ onSuccess, onError }: ActivityComposerProps) {
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [isPinned, setIsPinned] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user } = useAuth()
  const { mutate } = useSWRConfig()

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) {
      toast.error('请输入内容或添加图片')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          imageUrls: images,
          isPinned
        })
      })

      const result = await response.json()

      if (result.success) {
        // 乐观UI更新
        mutate('/api/activities')

        // 重置表单
        setContent('')
        setImages([])
        setIsPinned(false)

        onSuccess?.(result.data)
        toast.success('动态发布成功')
      } else {
        throw new Error(result.error.message)
      }
    } catch (error) {
      onError?.(error)
      toast.error('发布失败: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* 用户头像 */}
        <div className="flex gap-3">
          <Avatar>
            <AvatarImage src={user?.avatarUrl} />
            <AvatarFallback>{user?.name?.[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            {/* 内容输入 */}
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="分享你的想法..."
              className="min-h-[100px] resize-none"
              maxLength={5000}
            />

            {/* 字数统计 */}
            <div className="text-sm text-muted-foreground mt-1">
              {content.length} / 5000
            </div>

            {/* 图片上传 */}
            {images.length > 0 && (
              <ImageUploadGrid
                images={images}
                onUpload={setImages}
                maxImages={9}
              />
            )}

            {/* 操作栏 */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById('image-input')?.click()}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  图片
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPinned(!isPinned)}
                  className={isPinned ? 'text-primary' : ''}
                >
                  <Pin className="w-4 h-4 mr-2" />
                  置顶
                </Button>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || (!content.trim() && images.length === 0)}
              >
                {isSubmitting ? '发布中...' : '发布'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

#### 6.2.2 信息流容器

```typescript
// components/activity/activity-feed.tsx
interface ActivityFeedProps {
  userId?: string
  orderBy?: 'latest' | 'trending' | 'following'
  showComposer?: boolean
}

export function ActivityFeed({
  userId,
  orderBy = 'latest',
  showComposer = true
}: ActivityFeedProps) {
  const { data, error, size, setSize, isValidating } = useSWRInfinite(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.data.pagination.hasMore) {
        return null
      }

      const params = new URLSearchParams({
        page: (pageIndex + 1).toString(),
        limit: '20',
        orderBy,
        ...(userId && { authorId: userId })
      })

      return `/api/activities?${params}`
    },
    fetcher,
    {
      revalidateFirstPage: false,
      revalidateAll: false
    }
  )

  const activities = data ? data.flatMap(page => page.data.activities) : []
  const isLoadingInitialData = !data && !error
  const isLoadingMore = isLoadingInitialData ||
    (size > 0 && data && typeof data[size - 1] === 'undefined')
  const isEmpty = data?.[0]?.data.activities.length === 0
  const isReachingEnd = isEmpty ||
    (data && !data[data.length - 1]?.data.pagination.hasMore)

  // 无限滚动
  const { ref } = useInfiniteScroll({
    loading: isLoadingMore,
    hasMore: !isReachingEnd,
    onLoadMore: () => setSize(size + 1)
  })

  if (isLoadingInitialData) {
    return <ActivitySkeleton count={3} />
  }

  if (error) {
    return <ErrorMessage message="加载失败，请刷新重试" />
  }

  return (
    <div className="space-y-4">
      {/* 发布组件 */}
      {showComposer && <ActivityComposer />}

      {/* 动态列表 */}
      {isEmpty ? (
        <EmptyState message="暂无动态" />
      ) : (
        <>
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onLike={handleLike}
              onComment={handleComment}
              onShare={handleShare}
            />
          ))}

          {/* 加载更多触发器 */}
          <div ref={ref} className="h-10">
            {isLoadingMore && <LoadingSpinner />}
            {isReachingEnd && <EndMessage />}
          </div>
        </>
      )}
    </div>
  )
}
```

### 6.3 状态管理策略

```typescript
// hooks/use-activities.ts
export function useActivities(params?: ActivityParams) {
  const { data, error, mutate } = useSWR(
    params ? `/api/activities?${new URLSearchParams(params)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1分钟内去重
    }
  )

  return {
    activities: data?.data.activities,
    isLoading: !error && !data,
    isError: error,
    mutate,
  }
}

// hooks/use-activity-mutations.ts
export function useActivityMutations() {
  const { mutate } = useSWRConfig()

  const createActivity = async (data: CreateActivityData) => {
    // 乐观更新
    mutate(
      "/api/activities",
      async (activities) => {
        const optimisticActivity = {
          ...data,
          id: "temp-" + Date.now(),
          author: currentUser,
          createdAt: new Date().toISOString(),
          _count: { comments: 0, likes: 0 },
        }

        return {
          ...activities,
          data: {
            activities: [optimisticActivity, ...activities.data.activities],
          },
        }
      },
      false
    )

    // 实际请求
    const response = await fetch("/api/activities", {
      method: "POST",
      body: JSON.stringify(data),
    })

    // 重新验证
    mutate("/api/activities")

    return response.json()
  }

  const updateActivity = async (id: string, data: UpdateActivityData) => {
    // 类似的乐观更新逻辑
  }

  const deleteActivity = async (id: string) => {
    // 类似的乐观更新逻辑
  }

  return {
    createActivity,
    updateActivity,
    deleteActivity,
  }
}
```

---

## 7. 性能基线与测试策略

### 7.1 性能指标基线

#### 7.1.1 加载性能

| 指标                  | 目标值          | 测量方法            |
| --------------------- | --------------- | ------------------- |
| **首屏加载(FCP)**     | < 1.5秒         | Lighthouse          |
| **最大内容绘制(LCP)** | < 2.5秒         | Web Vitals          |
| **累积布局偏移(CLS)** | < 0.1           | Web Vitals          |
| **首次输入延迟(FID)** | < 100ms         | Web Vitals          |
| **信息流加载**        | < 2秒           | Custom Metrics      |
| **图片加载**          | < 500ms(缩略图) | Resource Timing API |

#### 7.1.2 交互性能

| 操作     | 目标响应时间 | 优化策略            |
| -------- | ------------ | ------------------- |
| 发布动态 | < 500ms      | 乐观UI + 后台同步   |
| 点赞操作 | < 100ms      | 乐观UI + 去抖动     |
| 图片上传 | < 3秒/张     | 并行上传 + 进度反馈 |
| 页面切换 | < 300ms      | 预加载 + 缓存       |
| 滚动加载 | < 1秒        | 虚拟滚动 + 分页     |

### 7.2 测试策略

#### 7.2.1 单元测试

```typescript
// tests/api/activities.test.ts
describe("Activities API", () => {
  describe("POST /api/activities", () => {
    it("应该创建动态成功", async () => {
      const mockUser = { id: "1", status: "ACTIVE" }
      const mockData = {
        content: "测试动态",
        imageUrls: ["url1", "url2"],
      }

      const response = await createActivity(mockData, mockUser)

      expect(response.success).toBe(true)
      expect(response.data.content).toBe(mockData.content)
      expect(response.data.imageUrls).toEqual(mockData.imageUrls)
    })

    it("应该拒绝BANNED用户", async () => {
      const mockUser = { id: "1", status: "BANNED" }

      const response = await createActivity({}, mockUser)

      expect(response.success).toBe(false)
      expect(response.error.code).toBe("USER_BANNED")
    })

    it("应该验证内容长度", async () => {
      const longContent = "a".repeat(5001)

      const response = await createActivity({ content: longContent }, mockUser)

      expect(response.success).toBe(false)
      expect(response.error.code).toBe("CONTENT_TOO_LONG")
    })
  })
})
```

#### 7.2.2 集成测试

```typescript
// tests/integration/activity-flow.test.ts
describe("Activity User Flow", () => {
  it("完整的动态发布流程", async () => {
    // 1. 用户登录
    const user = await login("test@example.com", "password")

    // 2. 上传图片
    const images = await uploadImages(["image1.jpg", "image2.jpg"])

    // 3. 发布动态
    const activity = await createActivity({
      content: "测试动态",
      imageUrls: images.urls,
    })

    // 4. 验证动态出现在信息流
    const feed = await getFeed()
    expect(feed.activities[0].id).toBe(activity.id)

    // 5. 编辑动态
    await updateActivity(activity.id, { isPinned: true })

    // 6. 验证置顶
    const userActivities = await getUserActivities(user.id)
    expect(userActivities[0].isPinned).toBe(true)
  })
})
```

#### 7.2.3 性能测试

```typescript
// tests/performance/activity-load.test.ts
describe("Activity Performance", () => {
  it("信息流加载应在2秒内完成", async () => {
    const startTime = performance.now()

    const response = await fetch("/api/activities?limit=20")
    const data = await response.json()

    const endTime = performance.now()
    const loadTime = endTime - startTime

    expect(loadTime).toBeLessThan(2000)
    expect(data.data.activities.length).toBe(20)
  })

  it("并发请求性能测试", async () => {
    const requests = Array(10)
      .fill(null)
      .map(() => fetch("/api/activities"))

    const startTime = performance.now()
    await Promise.all(requests)
    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(5000)
  })
})
```

### 7.3 监控与告警

```typescript
// lib/monitoring/activity-metrics.ts
export class ActivityMetrics {
  static async trackPerformance(metric: PerformanceMetric) {
    // 发送到监控服务
    await sendToMonitoring({
      type: "activity_performance",
      metric: metric.name,
      value: metric.value,
      timestamp: Date.now(),
    })

    // 告警阈值检查
    if (metric.name === "feed_load_time" && metric.value > 3000) {
      await triggerAlert({
        severity: "warning",
        message: `信息流加载时间超过3秒: ${metric.value}ms`,
      })
    }
  }

  static async trackError(error: Error, context: any) {
    await sendToMonitoring({
      type: "activity_error",
      error: {
        message: error.message,
        stack: error.stack,
        context,
      },
      timestamp: Date.now(),
    })
  }
}
```

---

## 8. 实施路线图

### 8.1 开发阶段划分

#### Phase 6.1: 基础架构 (Day 1-2)

- [x] 系统设计文档
- [ ] 数据库迁移脚本
- [ ] API路由框架搭建
- [ ] 权限中间件集成

#### Phase 6.2: 核心功能 (Day 3-4)

- [ ] 动态CRUD API实现
- [ ] 信息流查询优化
- [ ] 图片上传扩展
- [ ] 前端组件开发

#### Phase 6.3: 集成测试 (Day 5)

- [ ] API测试用例
- [ ] 前端集成测试
- [ ] 性能基线验证
- [ ] 安全审计

#### Phase 6.4: 优化部署 (Day 6)

- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 文档更新
- [ ] 部署验证

### 8.2 风险管理

| 风险项           | 影响等级 | 缓解措施             |
| ---------------- | -------- | -------------------- |
| 图片上传性能瓶颈 | 高       | 客户端压缩 + CDN加速 |
| 信息流查询性能   | 高       | 游标分页 + 索引优化  |
| 并发写入冲突     | 中       | 乐观锁 + 重试机制    |
| XSS安全风险      | 高       | 严格内容过滤 + CSP   |

### 8.3 验收标准

#### 功能验收

- [ ] 用户可以发布包含文本和多图的动态
- [ ] 支持动态的编辑、删除、置顶操作
- [ ] 信息流正确展示，支持分页
- [ ] 权限控制准确无误

#### 性能验收

- [ ] 信息流加载时间 < 2秒
- [ ] 发布动态响应时间 < 500ms
- [ ] 支持并发100个用户同时访问

#### 质量验收

- [ ] 测试覆盖率 > 80%
- [ ] 无P0/P1级别bug
- [ ] 通过安全审计

---

## 附录

### A. 相关文档链接

- [Phase 6 准备度评估报告](./Phase6-准备度评估报告.md)
- [系统模块设计顺序](../0-foundations/系统模块设计顺序.md)
- [项目架构设计](../0-foundations/现代博客项目架构设计.md)
- [数据库架构设计](../1-database/数据库架构设计说明.md)

### B. API测试工具

```bash
# 创建动态
curl -X POST http://localhost:3999/api/activities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "content": "测试动态",
    "imageUrls": ["url1", "url2"],
    "isPinned": false
  }'

# 获取信息流
curl http://localhost:3999/api/activities?page=1&limit=20&orderBy=latest

# 更新动态
curl -X PUT http://localhost:3999/api/activities/<id> \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "isPinned": true
  }'

# 删除动态
curl -X DELETE http://localhost:3999/api/activities/<id> \
  -H "Authorization: Bearer <token>"
```

### C. 性能测试脚本

```javascript
// scripts/test-activity-performance.js
const { performance } = require("perf_hooks")

async function testFeedLoadTime() {
  const iterations = 100
  const times = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fetch("http://localhost:3999/api/activities?limit=20")
    const end = performance.now()
    times.push(end - start)
  }

  const avg = times.reduce((a, b) => a + b) / times.length
  const max = Math.max(...times)
  const min = Math.min(...times)

  console.log(`平均加载时间: ${avg.toFixed(2)}ms`)
  console.log(`最大加载时间: ${max.toFixed(2)}ms`)
  console.log(`最小加载时间: ${min.toFixed(2)}ms`)
}

testFeedLoadTime()
```

---

**文档生成**: 2025-08-31 14:45:00  
**作者**: Claude  
**版本**: 1.0  
**状态**: ✅ 系统设计完成，待实施
