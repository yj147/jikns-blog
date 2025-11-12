# 关注系统 API 文档

## 概述

关注系统提供完整的用户关注功能，包括关注/取关、列表查询和批量状态查询。

### 技术特性

- ✅ **统一响应格式**：所有 API 使用 `ApiResponse` 接口
- ✅ **速率限制**：防止滥用，超限返回 429 + `Retry-After` header
- ✅ **审计日志**：记录所有操作，包含 requestId 追踪
- ✅ **性能监控**：记录关键指标（延迟、成功率）
- ✅ **幂等性**：重复操作返回一致结果
- ✅ **CSRF 保护**：生产环境强制验证

---

## API 端点

### 1. POST /api/users/:userId/follow

**功能**：关注指定用户

**认证**：需要登录（user-active 策略）

**速率限制**：30 次/分钟

**路径参数**：

- `userId` (string, required): 目标用户 ID

**成功响应** (200):

```json
{
  "success": true,
  "data": {
    "wasNew": true,
    "followerId": "user-123",
    "followingId": "user-456",
    "message": "已关注 该用户"
  },
  "meta": {
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

**错误响应**：

- `400 VALIDATION_ERROR`: 不能关注自己
- `401 UNAUTHORIZED`: 未登录
- `403 FORBIDDEN`: 账户被封禁
- `404 NOT_FOUND`: 目标用户不存在
- `429 RATE_LIMIT_EXCEEDED`: 速率限制超限
- `500 INTERNAL_ERROR`: 服务器错误

**速率限制响应** (429):

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "操作过于频繁，请稍后再试",
    "statusCode": 429,
    "timestamp": "2025-11-03T14:00:00.000Z"
  },
  "meta": {
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

**响应头**：

- `X-Request-ID`: 请求追踪 ID
- `Retry-After`: 速率限制触发时返回真实秒数（最小值 1 秒）
- `X-RateLimit-Limit`: 当前窗口允许的最大请求数（30）
- `X-RateLimit-Remaining`: 剩余请求数（触发限流时为 0）
- `X-RateLimit-Reset`: 限流窗口重置时间（ISO 8601）
- `X-RateLimit-Backend`: 实际限流后端（redis/memory）

> 成功响应与限流响应均会返回上述 `X-RateLimit-*`
> 响应头；在成功响应中，`X-RateLimit-Remaining` 表示当前窗口剩余额度。
> **幂等性**：重复关注返回成功，`wasNew: false`

---

### 2. DELETE /api/users/:userId/follow

**功能**：取消关注指定用户

**认证**：需要登录（user-active 策略）

**速率限制**：30 次/分钟（与 POST 共享）

**路径参数**：

- `userId` (string, required): 目标用户 ID

**成功响应** (200):

```json
{
  "success": true,
  "data": {
    "wasDeleted": true,
    "followerId": "user-123",
    "followingId": "user-456",
    "message": "已取消关注"
  },
  "meta": {
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

**错误响应**：同 POST 方法

**响应头**：同 POST 方法

**幂等性**：重复取关返回成功，`wasDeleted: false`

---

### 3. GET /api/users/:userId/followers

**功能**：获取用户的粉丝列表

**认证**：公开访问（public 策略）

**速率限制**：100 次/分钟（read 配额）

**路径参数**：

- `userId` (string, required): 用户 ID

**查询参数**：

- `limit` (number, optional): 每页数量，默认 20，最大 50
- `page` (number, optional): 页码（仅用于向后兼容，实际分页由游标驱动）
- `cursor` (string, optional): 分页游标（Base64 编码）
- `includeTotal` (boolean, optional): 是否统计总数。默认值为
  `true`（兼容既有客户端）；新客户端推荐显式传入 `false`
  跳过 COUNT(\*) 查询，仅在确需总数时再使用 `true`

**成功响应** (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "user-789",
      "name": "张三",
      "avatarUrl": "https://...",
      "bio": "个人简介",
      "status": "ACTIVE",
      "isMutual": true,
      "followedAt": "2025-11-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 128,
      "hasMore": true,
      "nextCursor": "eyJ2ZXJzaW9uIjoxLCJjcmVhdGVkQXQiOiIyMDI1LTExLTAxVDEwOjAwOjAwLjAwMFoiLCJpZCI6InVzZXItNzg5Iiwic2lnbmF0dXJlIjoiMTU3NjQ..."
    },
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

**字段说明**：

- `data`: 直接返回粉丝数组（不是 `data.items` 结构）
- `isMutual`: 是否互相关注
- `nextCursor`: 下一页游标（**Base64 + HMAC 签名**，包含
  `version`/`createdAt`/`id`，不是用户 ID）
- `total`: 当 `includeTotal=true` 时返回真实总数；`includeTotal=false` 时为
  `null`
- `page`: 页码（仅用于向后兼容，实际分页由 `cursor` 驱动）
- **注意**：响应中不包含 `email` 等敏感信息，只返回公开资料

**响应示例（includeTotal=false）**：

```json
{
  "success": true,
  "data": [
    {
      "id": "user-789",
      "name": "张三",
      "avatarUrl": "https://...",
      "bio": "个人简介",
      "status": "ACTIVE",
      "isMutual": true,
      "followedAt": "2025-11-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": null,
      "hasMore": true,
      "nextCursor": "eyJ2ZXJzaW9uIjoxLCJjcmVhdGVkQXQiOiIyMDI1LTExLTAxVDEwOjAwOjAwLjAwMFoiLCJpZCI6InVzZXItNzg5Iiwic2lnbmF0dXJlIjoiMTU3NjQ..."
    },
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

**游标编码规则**：

游标是 Base64 编码的 JSON 对象，包含以下字段：

- `version`: 游标版本号（当前为 `1`）
- `createdAt`: 关注时间（ISO 8601 格式）
- `id`: 用户 ID
- `signature`: HMAC-SHA256 签名，用 `FOLLOW_CURSOR_SECRET` 生成，防止伪造

**推荐使用官方工具**：

```typescript
import {
  encodeFollowCursor,
  decodeFollowCursor,
} from "@/lib/follow/cursor-utils"

// 编码游标
const cursor = encodeFollowCursor(new Date(), "user-789")
// "eyJ2ZXJzaW9uIjoxLCJjcmVhdGVkQXQiOiIyMDI1LTExLTAxVDEwOjAwOjAwLjAwMFoiLCJpZCI6InVzZXItNzg5Iiwic2lnbmF0dXJlIjoiMTU3NjQ..."

// 解码游标
const data = decodeFollowCursor(cursor)
// { createdAt: Date, id: "user-789" }
```

**手动解码示例**（不推荐）：

```typescript
// nextCursor: "eyJ2ZXJzaW9uIjoxLCJjcmVhdGVkQXQiOiIyMDI1LTExLTAxVDEwOjAwOjAwLjAwMFoiLCJpZCI6InVzZXItNzg5Iiwic2lnbmF0dXJlIjoiMTU3NjQ..."
const decoded = JSON.parse(Buffer.from(cursor, "base64").toString())
// { version: 1, createdAt: "2025-11-01T10:00:00.000Z", id: "user-789", signature: "15764..." }

// ⚠️ 请勿修改 signature 或手工构造游标；服务端会校验签名，非法游标将被拒绝。

> 部署服务端时必须配置 `FOLLOW_CURSOR_SECRET`，并保证该值保密且足够随机。
> 如需短期回滚旧客户端，可临时设置 `ALLOW_LEGACY_FOLLOW_CURSOR=true`，系统会在日志中输出警告；务必完成客户端升级后立即撤销该开关。
```

**性能优化建议**：

- 既有客户端：若无法调整请求参数，可继续沿用默认值（`includeTotal=true`），但需注意 COUNT(\*) 查询的潜在开销
- 新客户端：无限滚动等高频场景推荐显式传入
  `includeTotal=false`，仅在确需展示总数的首个请求使用
  `includeTotal=true`，后续分页继续传 `false`

**错误响应**：

- `404 NOT_FOUND`: 用户不存在
- `422 VALIDATION_ERROR`: 参数验证失败（如 limit 超过 50）
- `429 RATE_LIMIT_EXCEEDED`: 速率限制超限（Retry-After 头包含真实重试秒数）

---

### 4. GET /api/users/:userId/following

**功能**：获取用户的关注列表

**认证**：公开访问（public 策略）

**速率限制**：100 次/分钟（read 配额）

**参数和响应**：同 `/followers` 端点

---

### 5. POST /api/users/follow/status

**功能**：批量查询关注状态

**认证**：需要登录（user-active 策略）

**速率限制**：20 次/分钟（follow-status 配额）

**请求体**：

```json
{
  "targetIds": ["user-456", "user-789", "user-101"]
}
```

**请求体验证**：

- `targetIds` 必须是数组
- 数组元素必须是非空字符串（严格校验，避免 Prisma 500 错误）
- 数组长度 ≤ 50

**成功响应** (200):

```json
{
  "success": true,
  "data": {
    "user-456": { "isFollowing": true, "isMutual": false },
    "user-789": { "isFollowing": false, "isMutual": false },
    "user-101": { "isFollowing": true, "isMutual": true }
  },
  "meta": {
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

**字段说明**：

- `isFollowing`: 当前用户是否关注目标用户
- `isMutual`: 是否互相关注

**错误响应**：

- `400 VALIDATION_ERROR`: `targetIds` 不是数组，或包含非字符串/空字符串元素
- `429 LIMIT_EXCEEDED`: 超过 50 个 ID（批量查询数量限制）
- `401 UNAUTHORIZED`: 未登录
- `429 RATE_LIMIT_EXCEEDED`: 速率限制超限（Retry-After 头包含真实重试秒数）

**限流响应头**：

- `Retry-After`: 根据 `rateLimit.resetTime` 计算的真实秒数
- `X-RateLimit-Limit`: 当前窗口允许的最大请求数（20）
- `X-RateLimit-Remaining`: 剩余请求数（触发限流时为 0）
- `X-RateLimit-Reset`: 限流窗口重置的时间戳（ISO 8601）
- `X-RateLimit-Backend`: 实际生效的限流后端（如 `redis` / `memory`）

> 成功响应与限流响应均会返回上述 `X-RateLimit-*`
> 响应头；在成功响应中，`X-RateLimit-Remaining` 表示当前窗口剩余额度。

---

## 速率限制详情

### 限制配置

| 端点                | 限制        | 窗口  | 配额类型                   |
| ------------------- | ----------- | ----- | -------------------------- |
| POST /follow        | 30 次/分钟  | 60 秒 | `follow`（与 DELETE 共享） |
| DELETE /follow      | 30 次/分钟  | 60 秒 | `follow`（与 POST 共享）   |
| POST /follow/status | 20 次/分钟  | 60 秒 | `follow-status`（独立）    |
| GET /followers      | 100 次/分钟 | 60 秒 | `read`（共享）             |
| GET /following      | 100 次/分钟 | 60 秒 | `read`（共享）             |

### 速率限制响应

**状态码**：429 Too Many Requests

**响应头**：

- `Retry-After: <seconds>` - 真实的重试等待秒数（基于 `rateLimit.resetTime`
  计算）
- `X-Request-ID: req-abc123` - 请求追踪 ID

**注意**：`Retry-After`
头现在使用真实的重置时间计算，而非硬编码 60 秒，客户端应优先使用此值

**响应体**：

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "操作过于频繁，请稍后再试",
    "statusCode": 429,
    "timestamp": "2025-11-03T14:00:00.000Z"
  },
  "meta": {
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

### 客户端处理建议

```typescript
async function followUser(userId: string) {
  try {
    const response = await fetch(`/api/users/${userId}/follow`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After")
      console.log(`速率限制，请在 ${retryAfter} 秒后重试`)
      // 显示友好提示，禁用按钮 60 秒
      return
    }

    const data = await response.json()
    // 处理成功响应
  } catch (error) {
    // 处理网络错误
  }
}
```

---

### 数据库安全

- `public.follows` 已启用 Row Level
  Security：只有关注双方可以读取相关记录，写操作仅允许关注发起人
- 匿名角色不再拥有直接读写权限，需要通过受信任的服务端接口访问关注关系数据

---

## 审计日志

所有关注操作都会记录审计日志，包含以下信息：

- `action`: 操作类型（USER_FOLLOW / USER_UNFOLLOW）
- `resource`: 资源标识（user:${targetId}）
- `success`: 操作是否成功
- `userId`: 操作用户 ID
- `ipAddress`: 客户端 IP
- `userAgent`: 客户端 User-Agent
- `requestId`: 请求追踪 ID
- `details`: 额外信息（如 wasNew, rateLimited）

---

## 性能监控

### 监控指标

- **FOLLOW_ACTION_DURATION**: 关注/取关操作延迟
- **FOLLOW_ACTION_RATE_LIMIT**: 速率限制触发次数

### 记录维度

- `action`: follow / unfollow
- `wasNew`: 是否为新关注
- `wasDeleted`: 是否实际删除
- `rateLimited`: 是否触发限流
- `authFailed`: 是否认证失败

---

## 最佳实践

### 1. 使用 requestId 追踪请求

所有响应都包含 `meta.requestId`，用于日志追踪和问题排查。

### 2. 处理幂等性

重复操作返回成功，通过 `wasNew` / `wasDeleted` 判断是否实际执行。

### 3. 尊重速率限制

监听 429 响应和 `Retry-After` header，避免无效请求。

### 4. 错误处理

根据 `error.code` 进行分类处理，提供友好的用户提示。

### 5. 分页查询

使用 `cursor` 进行分页，避免使用 offset（性能更好）。

---

## 更新日志

### 2025-11-03

- ✅ 添加 `Retry-After` header 到所有 429 响应
- ✅ 统一响应格式（createErrorResponse）
- ✅ 完善 API 文档和使用示例
