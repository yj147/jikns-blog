# API路由统一错误处理模式示例

## P1-2重构后的推荐模式

### 模式1：使用 requireAuth/requireAdmin + handleApiError（简化版）

```typescript
import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/permissions"
import { handleApiError } from "@/lib/api/error-handler"
import { createSuccessResponse } from "@/lib/api/unified-response"

export async function GET(request: NextRequest) {
  try {
    // 直接调用requireAuth，失败会抛出AuthError
    const user = await requireAuth()

    // 业务逻辑
    const data = { userId: user.id, message: "成功" }
    return createSuccessResponse(data)
  } catch (error) {
    // handleApiError自动识别AuthError并返回合适的响应
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // 管理员权限检查
    const admin = await requireAdmin()

    // 执行删除操作
    // ...
    return createSuccessResponse({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
```

### 模式2：使用 withErrorHandler 装饰器（最简化）

```typescript
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/permissions"
import { withErrorHandler } from "@/lib/api/error-handler"
import { createSuccessResponse } from "@/lib/api/unified-response"

// 自动错误处理，无需手动try-catch
export const GET = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth()
  const data = { userId: user.id }
  return createSuccessResponse(data)
})

export const POST = withErrorHandler(async (request: NextRequest) => {
  const user = await requireAuth()
  const body = await request.json()
  // 业务逻辑...
  return createSuccessResponse({ created: true })
})
```

### 模式3：使用 assertPolicy（审计日志需求）

当需要详细的审计日志时，使用`assertPolicy`返回元组模式：

```typescript
import { NextRequest } from "next/server"
import { assertPolicy, generateRequestId } from "@/lib/auth/session"
import {
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api/unified-response"
import { auditLogger } from "@/lib/audit-log"

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  const [user, authError] = await assertPolicy("user-active", {
    path: request.nextUrl.pathname,
    requestId,
  })

  if (authError) {
    await auditLogger.logEvent({
      action: "RESOURCE_ACCESS_DENIED",
      success: false,
      errorMessage: authError.message,
    })
    return createErrorResponse(/* ... */)
  }

  // 业务逻辑
  await auditLogger.logEvent({
    action: "RESOURCE_ACCESSED",
    success: true,
    userId: user.id,
  })
  return createSuccessResponse(data)
}
```

## Linus评审

**品味评分**: 🟢 好品味（重构后）

**关键改进**:

1. ✅ 消除特殊情况 - 统一使用抛异常模式
2. ✅ 简化代码 - 从多种错误处理减少到一种
3. ✅ 数据结构清晰 - AuthError包含所有必要信息

**推荐使用**:

- 简单API：使用模式2（withErrorHandler）
- 一般API：使用模式1（try-catch + handleApiError）
- 审计API：使用模式3（assertPolicy + 详细日志）

## 迁移指南

### 旧模式（需要迁移）

```typescript
// ❌ 旧模式：返回Response
const authResult = await requireAuthRoute()
if (authResult instanceof Response) {
  return authResult
}
const user = authResult
```

### 新模式（推荐）

```typescript
// ✅ 新模式：抛异常
try {
  const user = await requireAuth()
  // 业务逻辑
} catch (error) {
  return handleApiError(error)
}
```

### 或使用装饰器（最简洁）

```typescript
// ✅ 最简洁：自动错误处理
export const GET = withErrorHandler(async (request) => {
  const user = await requireAuth()
  return createSuccessResponse(data)
})
```

## 向后兼容性

- ✅ `requireAuth()` / `requireAdmin()` - 继续使用抛异常模式
- ✅ `getUserOrNull()` - 保留，用于可选认证场景
- ❌ `requireAuthRoute()` / `requireAdminRoute()` - 已删除
- ✅ `assertPolicy()` - 保留，用于详细审计日志场景
