# 权限系统使用指南

本文档介绍如何使用项目中的三层权限控制系统。

## 系统架构

```
1. middleware.ts          # 网络层安全 + 路径级权限验证
2. API Guards             # API 路由 + Server Actions 权限保护
3. 前端权限组件            # UI 级权限控制
```

## 1. 前端权限组件使用

### ProtectedRoute - 页面级权限保护

```tsx
import { ProtectedRoute } from '@/components/auth'

// 保护整个页面，需要用户认证
<ProtectedRoute>
  <UserDashboard />
</ProtectedRoute>

// 自定义未授权页面
<ProtectedRoute
  fallback={<div>请先登录</div>}
  redirectTo="/login"
>
  <ProtectedContent />
</ProtectedRoute>
```

### AdminOnly - 管理员专用组件

```tsx
import { AdminOnly } from '@/components/auth'

// 仅管理员可见的内容
<AdminOnly>
  <AdminPanel />
</AdminOnly>

// 自定义权限不足提示
<AdminOnly
  fallback={<div>管理员专用功能</div>}
  showFallback={true}
>
  <UserManagement />
</AdminOnly>
```

### AuthRequired - 功能级认证保护

```tsx
import { AuthRequired } from "@/components/auth"

// 包装需要登录的功能按钮
;<AuthRequired message="点赞功能需要登录">
  <LikeButton postId={post.id} />
</AuthRequired>
```

## 2. 权限检查 Hooks

### usePermissions - 权限状态检查

```tsx
import { usePermissions } from "@/hooks/use-permissions"

function UserProfile() {
  const {
    isAdmin,
    canCreatePost,
    canComment,
    canAccessResource,
    canPerformAction,
  } = usePermissions()

  return (
    <div>
      {isAdmin && <AdminBadge />}

      {canCreatePost && <Button onClick={createPost}>发布文章</Button>}

      {canComment && <CommentForm />}

      {canAccessResource("/admin") && <Link href="/admin">管理后台</Link>}

      {canPerformAction("edit:post", postId) && <Button>编辑文章</Button>}
    </div>
  )
}
```

### usePermissionGuard - 权限守卫

```tsx
import { usePermissionGuard } from "@/hooks/use-permissions"

function InteractiveButton() {
  const { createProtectedHandler } = usePermissionGuard()

  const handleLike = createProtectedHandler(
    "canLike",
    () => {
      // 执行点赞逻辑
      console.log("点赞成功")
    },
    (reason) => {
      // 权限不足处理
      alert(`无法点赞: ${reason}`)
    }
  )

  return <Button onClick={handleLike}>点赞</Button>
}
```

### ConditionalPermission - 条件渲染

```tsx
import { ConditionalPermission } from '@/hooks/use-permissions'

// 基于权限条件渲染
<ConditionalPermission
  permission="canCreatePost"
  fallback={<div>无权限创建文章</div>}
>
  <CreatePostButton />
</ConditionalPermission>

// 基于操作权限渲染
<ConditionalPermission permission="edit:post">
  <EditButton />
</ConditionalPermission>
```

## 3. API 路由权限保护

### 管理员专用 API

```tsx
// app/api/admin/users/route.ts
import { withApiAuth } from "@/lib/api-guards"

async function getUsersHandler(request: NextRequest, admin: User) {
  // 管理员权限已验证，可以安全执行管理操作
  const users = await prisma.user.findMany()
  return createSuccessResponse(users, admin)
}

// 应用管理员权限守卫
export const GET = withApiAuth(getUsersHandler, "admin")
```

### 用户认证 API

```tsx
// app/api/user/profile/route.ts
import { withApiAuth } from "@/lib/api-guards"

async function getProfileHandler(request: NextRequest, user: User) {
  // 用户认证已验证，可以访问用户数据
  const profile = await getUserProfile(user.id)
  return createSuccessResponse(profile, user)
}

// 应用用户认证守卫
export const GET = withApiAuth(getProfileHandler, "auth")
```

### 公开 API

```tsx
// app/api/public/posts/route.ts
import { withApiAuth } from "@/lib/api-guards"

async function getPublicPostsHandler(request: NextRequest) {
  const posts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
  })
  return createSuccessResponse(posts)
}

// 公开 API 无需权限验证
export const GET = withApiAuth(getPublicPostsHandler, "public")
```

## 4. Server Actions 权限保护

```tsx
// lib/actions/post-actions.ts
import { withServerActionAuth } from "@/lib/api-guards"

async function createPostAction(user: User, formData: FormData) {
  // 管理员权限已验证
  const title = formData.get("title") as string
  const content = formData.get("content") as string

  const post = await prisma.post.create({
    data: { title, content, authorId: user.id },
  })

  return { success: true, post }
}

// 应用管理员权限保护
export const createPost = withServerActionAuth(createPostAction, "admin")
```

## 5. 复合权限装饰器

```tsx
// app/api/complex/route.ts
import { withApiMiddleware } from "@/lib/api-guards"

async function complexHandler(request: NextRequest, user: User) {
  // 处理复杂的业务逻辑
  return createSuccessResponse({ message: "success" }, user)
}

// 应用多重保护：认证 + 限流 + CORS
export const POST = withApiMiddleware(complexHandler, {
  permissionLevel: "auth",
  rateLimit: { requests: 50, window: 60000 }, // 每分钟50次
  cors: { origins: ["https://yourdomain.com"] },
})
```

## 6. 中间件配置

中间件已自动配置在 `middleware.ts` 中，提供：

- **路径级权限控制**: 自动保护管理员路径
- **安全头部**: CSP、XSS保护、CORS等
- **速率限制**: 防止暴力攻击
- **CSRF 保护**: 状态变更请求的令牌验证
- **会话安全**: 会话指纹验证

## 7. 错误处理

### 权限错误类型

- `AUTHENTICATION_REQUIRED`: 需要登录
- `INSUFFICIENT_PERMISSIONS`: 权限不足
- `ACCOUNT_BANNED`: 账户被封禁
- `RATE_LIMITED`: 请求过于频繁

### 自动重定向

权限系统会自动处理以下重定向：

- 未登录用户 → `/login?redirect={current_path}`
- 权限不足 → `/unauthorized?reason=insufficient_permissions`
- 账户封禁 → `/unauthorized?reason=account_banned`

## 8. 性能优化

### 权限缓存

- 用户权限信息缓存 5 分钟
- 自动失效和清理机制
- 被封禁用户缓存立即清除

```tsx
import { clearPermissionCache } from "@/lib/permissions"

// 手动清除特定用户缓存
clearPermissionCache(userId)

// 清除所有缓存
clearPermissionCache()
```

### 批量权限检查

```tsx
import { batchPermissionCheck } from "@/lib/permissions"

const permissions = await batchPermissionCheck([
  "/admin",
  "create:post",
  "edit:user",
])

// permissions['admin'] = true/false
// permissions['create:post'] = true/false
```

## 9. 安全最佳实践

### 输入验证

所有用户输入自动进行 XSS 防护：

```tsx
import { XSSProtection } from "@/lib/security"

const safeContent = XSSProtection.validateAndSanitizeInput(userInput)
```

### 安全头部

自动应用安全头部：

- Content Security Policy (CSP)
- X-XSS-Protection
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security (生产环境)

### CSRF 保护

状态变更操作自动进行 CSRF 验证：

```tsx
// 前端自动设置 CSRF 令牌
// API 路由自动验证 CSRF 令牌
```

## 10. 测试支持

权限组件提供测试友好的 data-testid：

```tsx
// ProtectedRoute 组件
data-testid="loading"           // 加载状态
data-testid="unauthorized"      // 未授权状态

// AdminOnly 组件
data-testid="admin-loading"     // 管理员验证中
data-testid="admin-banned"      // 管理员被封禁
```

## 11. 故障排除

### 常见问题

1. **权限检查失败**
   - 检查用户是否已登录
   - 验证用户角色和状态
   - 查看控制台错误日志

2. **中间件错误**
   - 检查环境变量配置
   - 验证 Supabase 连接
   - 查看网络请求状态

3. **API 权限拒绝**
   - 确认 API 路由权限级别配置
   - 检查请求头部是否包含认证信息
   - 验证 CSRF 令牌设置

### 调试工具

```tsx
// 开发环境下查看权限状态
import { usePermissions } from "@/hooks/use-permissions"

function DebugPermissions() {
  const permissions = usePermissions()

  if (process.env.NODE_ENV === "development") {
    console.log("当前用户权限:", permissions)
  }

  return null
}
```

这个权限系统提供了企业级的安全防护和用户友好的权限管理体验。通过三层架构确保了全面的安全覆盖，同时保持了开发的便利性和性能的优化。
