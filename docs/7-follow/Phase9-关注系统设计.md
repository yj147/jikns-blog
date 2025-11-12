# Phase 9：用户关注系统设计文档

**版本**: v0.1  
**发布日期**: 2025-09-28  
**撰写人**: Linus 模式技术助手  
**关联阶段**: Phase 9（关注系统）

---

## 1. 背景 & 目标

### 1.1 背景

- Phase
  5–8 已完成文章、动态、评论、点赞收藏等核心互动模块，并通过全模块架构收敛计划统一了认证、响应规范与交互服务层。参见
  `docs/Architecture-Remediation-Report-Phase-A-C.md`。
- 数据层已具备 `Follow` 自引用关系，API 侧已试点实现
  `/app/api/users/[userId]/follow` 路由与推荐用户接口。
- Feed 页面支持 `following` 排序，仓储层 `listActivities`
  已实现以关注列表过滤作者，配套测试覆盖完备。

### 1.2 目标

1. 交付完整的用户关注/取关能力，确保幂等、防止自关注，并统一审计与速率限制策略。
2. 基于关注关系提供“关注流”信息源、关注列表/粉丝列表管理界面与关注状态指示器。
3. 建立关注模块的监控指标、灰度方案与回滚策略，做到 Never break userspace。

### 1.3 成功判定

- ✅ 用户可在用户卡片、资料页、Feed 推荐区执行关注/取关，并即时刷新 UI。
- ✅ `/api/users/followers`、`/api/users/following`
  接口返回分页列表，具备有效的速率限制与缓存策略。
- ✅ Feed “关注”标签仅展示被关注作者的动态，分页与测试全部通过。
- ✅ 指标面板可观测关注事件量、速率限制命中率、关注流接口错误率。

---

## 2. 范围界定

### 2.1 In Scope

- 后端：关注关系 API、粉丝/关注列表 API、关注状态批量查询接口、审计与指标。
- 前端：Feed 页签、推荐用户卡、用户资料页、设置页关注管理、关注按钮组件化。
- 客户端钩子与状态：`useFollowUser`、`useSuggestedUsers`、新增 `useFollowers` /
  `useFollowing`。
- 监控：新增 MetricType、脚本更新、Dashboard Schema。

### 2.2 Out of Scope

- 推荐算法的高级特性（共同关注、二度关系建议）。
- 推送/通知系统（Phase 10+）。
- 复杂的批量导入/导出与组织账号关注管理。

---

## 3. 依赖 & 前置条件

| 类型      | 说明                                            | 状态                                       |
| --------- | ----------------------------------------------- | ------------------------------------------ |
| 数据模型  | `Follow` 复合主键 (`followerId`, `followingId`) | ✅ 已存在 (`prisma/schema.prisma:212-222`) |
| 认证抽象  | `assertPolicy`, `withApiAuth`                   | ✅ Phase A 收敛完成                        |
| 交互服务  | Likes/Bookmarks/Comments 通用层                 | ✅ Phase B/C 完成                          |
| 活动仓储  | `listActivities` 支持 `followingUserId`         | ✅ 具备 (`lib/repos/activity-repo.ts`)     |
| Feed 页面 | “following” Tab + 推荐卡片                      | ✅ 已上线 (`app/feed/page.tsx`)            |
| 监控框架  | `performanceMonitor`, `MetricType`              | ✅ `docs/monitoring-validation-plan.md`    |
| Redis     | `UPSTASH_REDIS_*`（限流集中存储）               | ⚠️ 需在部署前确认凭证                      |

---

## 4. 架构总览

### 4.1 组件与交互

```
用户操作 → 前端 `FollowButton` → `useFollowUser` hook → `/api/users/{id}/follow` → Prisma Follow 表
                                                      → `auditLogger` 记录操作
                                    ↘ 触发 SWR `mutate` 刷新本地关注状态

关注流查询 → `useActivities({ orderBy: 'following' })` → `/api/activities` → `listActivities` 带入 `followingUserId` → Feed 列表渲染

粉丝/关注列表 → 新增 `/api/users/{id}/followers` | `/following` → `FollowService.listFollowers/listFollowing`

监控 → `performanceMonitor.recordMetric(MetricType.FOLLOW_ACTION_DURATION / FOLLOW_ACTION_RATE_LIMIT / FEED_FOLLOWING_RESULT_COUNT)` → `collect-monitoring-data.sh`
```

### 4.2 服务分层

- **API 层**：Next.js Route
  Handler，负责鉴权、输入校验、审计、响应封装与速率限制；保持 requestId/IP/UA 等上下文的唯一来源。
- **Service 层**：`@/lib/interactions/follow.ts`（新建），封装创建/删除/查询逻辑、计数与缓存处理，保持纯业务函数（不依赖 Request 上下文、不直接写审计日志）。
- **Repo 层**：重用 Prisma Client，无额外中间层。
- **UI 层**：通用 `FollowButton` 组件与列表视图组件。

---

## 5. 数据模型 & 缓存策略

### 5.1 Prisma 模型回顾

```prisma
model Follow {
  followerId  String
  followingId String
  createdAt   DateTime @default(now())
  follower    User     @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)
  following   User     @relation("Following", fields: [followingId], references: [id], onDelete: Cascade)

  @@id([followerId, followingId])
  @@index([followerId])
  @@index([followingId])
  @@map("follows")
}
```

### 5.2 衍生字段 & 缓存

- 用户 `_count.followers`、`_count.following` 通过 Prisma `_count`
  查询，无需冗余列。
- 对关注状态批量查询（列表页）引入轻量缓存：
  - 前端：`sessionStorage` 记忆最近一次关注操作结果。
  - 服务端：可选 `unstable_cache` 缓存 `listFollowers` / `listFollowing`
    分页 30s，用于热门用户访问。

---

## 6. 后端设计

### 6.1 新增/调整的 API

| 路径                            | 方法   | 描述                 | 鉴权策略        | 速率限制                 |
| ------------------------------- | ------ | -------------------- | --------------- | ------------------------ |
| `/api/users/[userId]/follow`    | POST   | 关注目标用户         | `user-active`   | `follow` (max 30/min)    |
| `/api/users/[userId]/follow`    | DELETE | 取消关注             | `user-active`   | `follow`                 |
| `/api/users/[userId]/followers` | GET    | 获取粉丝列表（分页） | `public` 可访问 | `activity.read` (shared) |
| `/api/users/[userId]/following` | GET    | 获取关注列表（分页） | `public` 可访问 | `activity.read`          |
| `/api/users/follow/status`      | POST   | 批量查询关注状态     | `user-active`   | `follow-status`          |

#### 6.1.1 请求/响应示例

- `GET /api/users/{id}/followers?page=1&limit=20`

```json
{
  "success": true,
  "data": [
    {
      "id": "user-123",
      "name": "Linus",
      "avatarUrl": "...",
      "bio": "...",
      "isMutual": true,
      "followedAt": "2025-09-28T09:32:10.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "hasMore": true,
      "nextCursor": "fol_abc..."
    }
  }
}
```

### 6.2 服务层 `@/lib/interactions/follow.ts`

- `followUser(followerId, targetId)`
- `unfollowUser(followerId, targetId)`
- `listFollowers(userId, params)`
- `listFollowing(userId, params)`
- `getFollowStatusBatch(actorId, targetIds[])`

关键注意：

- 关注/取关操作包裹在事务，保证 `_count` 查询一致性。
- 捕获 `P2002` (主键冲突) 视为重复关注，返回幂等成功。
- Service 层保持纯函数风格，仅返回业务结果；审计日志、速率限制、请求上下文处理必须由 API 层调用方负责，避免在无
  `Request` 上下文的情况下写日志。

### 6.3 统一响应格式规范

**所有API路由必须使用统一响应格式工具**（`lib/api/unified-response.ts`）：

```typescript
// 成功响应
return createSuccessResponse(data, meta)

// 错误响应
return createErrorResponse(ErrorCode.XXX, message, details)

// 分页响应
return createPaginatedResponse(data, pagination, meta)
```

**关键要求**：

- ✅ 使用 `ErrorCode` 枚举（已包含
  `CANNOT_FOLLOW_SELF`、`ALREADY_FOLLOWING`、`NOT_FOLLOWING_YET` 等）
- ✅ 错误响应自动记录日志（5xx级别记录error，4xx级别记录warn）
- ✅ 分页响应包含 `hasMore`、`nextCursor` 字段
- ✅ 所有响应包含 `meta.timestamp` 和 `meta.requestId`

**参考实现**：`app/api/users/[userId]/follow/route.ts`

### 6.4 速率限制策略

- 复用 `lib/rate-limit/activity-limits.ts`，新增枚举项
  `follow`、`follow-status`，并暴露公共常量供 API 层读取。
- 配置：
  - `follow`: 60 秒内最多 30 次（合并关注/取消关注）。
  - `follow-status`: 60 秒内最多 20 次批量查询。
- 若 `UPSTASH_REDIS_*`
  缺失，回退内存限流，日志提示需配置集中式存储；部署 checklist 必须在灰度前验证 Redis 已生效。

---

## 7. 前端设计

### 7.1 组件

- `FollowButton`
  - Props: `targetUserId`, `initialFollowing`, `size`, `variant`。
  - 内部使用 `useFollowUser`，乐观更新 `followingUsers` 集合。
- `FollowList`
  - 用于粉丝/关注列表页面，内部调用 `useFollowers`/`useFollowing`。
- 调整 `RecommendedUserCard` 复用 `FollowButton`。

### 7.2 页面 & 入口

- Feed (`app/feed/page.tsx`)：
  - 保持 tabs 逻辑，登陆前点击关注 Tab 提示登录。
  - 针对 `following` 列表添加空态（未关注任何人）。
- 用户资料视图：
  - 目前仅存在 `app/profile/page.tsx`（当前用户主页）。先拆分为 `(me)` 与
    `(users)` 两个路由组：
    - 将现有页面迁移至 `app/(me)/profile/page.tsx`，保留个人资料编辑入口。
    - 新增 `app/(users)/users/[id]/page.tsx`
      渲染任意用户的公开资料，集成关注按钮、粉丝/关注入口。
  - 更新 `Navigation` 与所有 `Link` 引用，避免既有路径失效。
- 设置页 `app/settings/page.tsx`：
  - 在隐私或账户分栏加入“关注管理”入口，跳转到新页面
    `/settings/following`，承载关注/粉丝列表管理。

### 7.3 数据流 & 状态管理

- `useFollowUser`
  - 在成功响应后触发 `globalMutate`，刷新 `/api/users/suggested` 与
    `/api/activities` 首屏缓存。
  - 当取关后若当前标签为 `following`，触发列表重新请求。
  - 针对速率限制或鉴权失败的响应，统一返回结构 `{ code, message, retryAfter? }`
    供按钮组件渲染。
- `useFollowers` / `useFollowing`
  - 基于 `useSWRInfinite`，默认 limit=20，支持 `nextCursor`，并利用缓存键
    `${listType}-${userId}` 保障跨页面复用。
  - 暂无服务端 `unstable_cache`，先实现客户端缓存与 SWR
    mutate，后续视监控结果评估。

### 7.4 与现有模块的集成

#### 7.4.1 Feed 页面集成（✅ 已完成）

**文件**：`app/feed/page.tsx`

**集成点1：关注流 Tab**

- 当用户选择"关注"Tab 时，`orderBy` 参数设置为 `"following"`
- API 根据当前用户的关注关系过滤动态（`listActivities` 已支持 `followingUserId`
  参数）
- 未登录用户禁用"关注"Tab（`disabled={!user}`）
- 空状态提示："还没有关注任何人，关注感兴趣的用户，查看他们的最新动态吧！"

**集成点2：推荐用户卡片**

- 右侧边栏显示推荐用户列表（`useSuggestedUsers` Hook）
- 每个用户卡片集成 `FollowButton` 组件
- 关注/取关成功后调用 `refresh()` 刷新 Feed 数据
- 支持乐观更新和错误回滚

**代码示例**：

```typescript
<FollowButton
  targetUserId={suggestedUser.id}
  size="sm"
  onFollowSuccess={() => refresh()}
  onUnfollowSuccess={() => refresh()}
/>
```

#### 7.4.2 设置页面集成（✅ 已完成）

**文件**：`app/settings/page.tsx`

**集成点：社交关系管理 Tab**

- 显示"关注的人"和"粉丝"两个子 Tab
- 使用 `useFollowers` 和 `useFollowing` Hooks
- 支持无限滚动加载（`loadMore` 函数）
- 显示关注/粉丝数量统计（`pagination.total`）
- 每个用户项集成 `FollowButton` 组件

**实现状态**：✅ 已完成基础功能

#### 7.4.3 用户资料页集成（⚠️ 待实现）

**文件**：`app/(users)/users/[id]/page.tsx`（待创建）

**集成点1：用户资料头部**

- 显示关注/粉丝数量统计（从 User 模型的 `_count` 字段获取）
- 查看他人资料时显示 `FollowButton` 组件
- 查看自己资料时不显示关注按钮

**集成点2：关注/粉丝列表 Tab**

- 使用 `useFollowers` 和 `useFollowing` Hooks
- 支持无限滚动加载
- 每个用户项集成 `FollowButton`

**实现状态**：⚠️ 待实现（Phase 9 M2 里程碑）

#### 7.4.4 前端状态同步策略

**问题**：关注/取关操作后，多个页面的状态可能不同步。

**解决方案**：

1. **全局缓存刷新**：使用 SWR 的 `globalMutate` 机制

   ```typescript
   // 在 useFollowUser Hook 中
   const mutateCacheKeys = [
     "/api/users/suggested",
     "/api/activities",
     "/api/users/follow/status",
   ]
   ```

2. **乐观更新**：立即更新 UI，失败时回滚

   ```typescript
   // 关注操作前
   optimisticUpdate(userId, true)

   // 失败时回滚
   rollbackOptimisticUpdate(userId, wasFollowing)
   ```

3. **关键页面重新验证**：使用 `revalidateOnFocus` 确保数据新鲜度
   ```typescript
   const { data } = useSWR(key, fetcher, {
     revalidateOnFocus: true, // 页面获得焦点时重新验证
   })
   ```

---

## 8. 安全与合规

- 鉴权：所有读操作允许匿名访问，写操作强制 `user-active`
  策略，封禁用户无法发起关注。
- 自关注防护：服务器端直接校验 `targetId === actorId` 返回 `VALIDATION_ERROR`。
- 循环依赖：互关允许，不作额外限制。
- 审计：`USER_FOLLOW`、`USER_UNFOLLOW`、`USER_FOLLOW_LIST_VIEW`
  等动作写入审计日志。
- CSRF：沿用统一的 `secureFetch` 与 `X-CSRF-Token` 机制。

---

## 9. 性能 & 可观测性

- 新增 `MetricType`：
  - `FOLLOW_ACTION_DURATION`（ms）
  - `FOLLOW_ACTION_RATE_LIMIT`（计数/命中状态）
  - `FEED_FOLLOWING_RESULT_COUNT`（关注流返回条数）
- 在 `lib/performance-monitor.ts` 追加上述枚举，并在 API 层调用
  `performanceMonitor.recordMetric`，统一采用现有 `ACTIVITY_RATE_LIMIT_CHECK`
  的调用模式。
- 更新 `scripts/collect-monitoring-data.sh`
  与每日汇总 Markdown 输出，新增关注指标段落，并支持 `--focus follow`
  参数聚焦关注模块；若脚本缺少 flag 解析需同时补齐。
- 关键 SLI：
  - 关注 API P95 < 200ms。
  - 关注流接口 error rate < 1%。
  - 速率限制命中率 < 5%。

---

## 10. 测试计划

| 类型     | 目标                                           | 工具                                         |
| -------- | ---------------------------------------------- | -------------------------------------------- |
| 单元测试 | `followUser` 并发/幂等、批量状态查询、列表分页 | Vitest (`tests/unit/follow-service.test.ts`) |
| API 契约 | 关注/取关、重复关注、未登录、粉丝列表分页      | Vitest (`tests/api/follow-route.test.ts`)    |
| 集成测试 | Feed following tab + 推荐卡关注流程            | Playwright (`tests/e2e/follow-flow.spec.ts`) |
| 安全测试 | 速率限制、CSRF、审计字段                       | Vitest + 手工脚本                            |

自动化要求：所有新增测试纳入 `pnpm quality:check`。

### 10.1 单元测试用例

**文件**：`tests/unit/follow-service.test.ts`

```typescript
describe("followUser", () => {
  it("应该成功关注用户", async () => {
    const result = await followUser("user1", "user2")
    expect(result.wasNew).toBe(true)
    expect(result.followerId).toBe("user1")
    expect(result.followingId).toBe("user2")
  })

  it("应该防止自我关注", async () => {
    await expect(followUser("user1", "user1")).rejects.toThrow(
      FollowServiceError
    )
    await expect(followUser("user1", "user1")).rejects.toMatchObject({
      code: "SELF_FOLLOW",
    })
  })

  it("应该处理重复关注（幂等性）", async () => {
    await followUser("user1", "user2")
    const result = await followUser("user1", "user2")
    expect(result.wasNew).toBe(false) // 第二次返回 false
  })

  it("应该拒绝关注不存在的用户", async () => {
    await expect(followUser("user1", "nonexistent")).rejects.toMatchObject({
      code: "TARGET_NOT_FOUND",
    })
  })

  it("应该拒绝关注被封禁的用户", async () => {
    await expect(followUser("user1", "bannedUser")).rejects.toMatchObject({
      code: "TARGET_INACTIVE",
    })
  })
})

describe("unfollowUser", () => {
  it("应该成功取消关注", async () => {
    await followUser("user1", "user2")
    const result = await unfollowUser("user1", "user2")
    expect(result.wasDeleted).toBe(true)
  })

  it("应该处理重复取关（幂等性）", async () => {
    const result = await unfollowUser("user1", "user2")
    expect(result.wasDeleted).toBe(false) // 未关注时返回 false
  })
})

describe("getFollowStatusBatch", () => {
  it("应该批量查询关注状态", async () => {
    await followUser("user1", "user2")
    const result = await getFollowStatusBatch("user1", ["user2", "user3"])
    expect(result["user2"].isFollowing).toBe(true)
    expect(result["user3"].isFollowing).toBe(false)
  })

  it("应该限制批量查询数量", async () => {
    const largeList = Array.from({ length: 51 }, (_, i) => `user${i}`)
    await expect(
      getFollowStatusBatch("user1", largeList)
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" })
  })
})
```

### 10.2 API 路由测试用例

**文件**：`tests/api/follow-route.test.ts`

```typescript
describe("POST /api/users/[userId]/follow", () => {
  it("应该要求用户认证", async () => {
    const response = await POST(mockRequest, { params: { userId: "user2" } })
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe("UNAUTHORIZED")
  })

  it("应该执行速率限制", async () => {
    // 模拟超过速率限制（30次/分钟）
    for (let i = 0; i < 31; i++) {
      await POST(mockAuthRequest, { params: { userId: `user${i}` } })
    }
    const response = await POST(mockAuthRequest, {
      params: { userId: "user99" },
    })
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED")
  })

  it("应该记录审计日志", async () => {
    await POST(mockAuthRequest, { params: { userId: "user2" } })
    expect(auditLogger.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "USER_FOLLOW",
        resource: "user:user2",
        userId: "user1",
      })
    )
  })

  it("应该使用统一响应格式", async () => {
    const response = await POST(mockAuthRequest, {
      params: { userId: "user2" },
    })
    const body = await response.json()
    expect(body).toHaveProperty("success")
    expect(body).toHaveProperty("data")
    expect(body).toHaveProperty("meta.timestamp")
  })
})
```

### 10.3 E2E 测试用例

**文件**：`tests/e2e/follow-flow.spec.ts`

```typescript
test("用户应该能够在 Feed 页面关注推荐用户", async ({ page }) => {
  await page.goto("/feed")

  // 验证推荐用户卡片存在
  await expect(page.locator('[data-testid="suggested-users"]')).toBeVisible()

  // 点击关注按钮
  await page.click('[data-testid="follow-button-user2"]')

  // 验证按钮状态变化
  await expect(
    page.locator('[data-testid="follow-button-user2"]')
  ).toContainText("已关注")

  // 切换到关注 Tab
  await page.click('[data-testid="tab-following"]')

  // 验证关注流中出现该用户的动态
  await expect(page.locator('[data-author-id="user2"]')).toBeVisible()
})

test("用户应该能够取消关注", async ({ page }) => {
  await page.goto("/feed")

  // 先关注
  await page.click('[data-testid="follow-button-user2"]')
  await expect(
    page.locator('[data-testid="follow-button-user2"]')
  ).toContainText("已关注")

  // 再取消关注
  await page.click('[data-testid="follow-button-user2"]')
  await expect(
    page.locator('[data-testid="follow-button-user2"]')
  ).toContainText("关注")
})

test("未登录用户应该无法访问关注 Tab", async ({ page }) => {
  await page.goto("/feed")

  // 验证关注 Tab 被禁用
  const followingTab = page.locator('[data-testid="tab-following"]')
  await expect(followingTab).toBeDisabled()
})
```

### 10.4 覆盖率要求

- **服务层**：≥90%（核心业务逻辑）
- **API 路由**：≥85%（包含错误处理分支）
- **Hooks**：≥80%（包含乐观更新和回滚逻辑）
- **组件**：≥75%（UI 交互逻辑）

---

## 11. 推出策略

1. **Feature Flag**：新增 `FEATURE_FEED_FOLLOWING_STRICT`，在
   `lib/config/feature-flags.ts` 注册读取方法，并新增 `package.json` 脚本
   `feature:set`（调用
   `tsx scripts/feature-flags.ts set <flag> <on|off>`）以便 CI/运维操作。
2. **分阶段部署**：
   - 阶段 A：后端 API + 服务层上线，前端按钮隐藏。
   - 阶段 B：内部账号打开前端按钮，验证关注流与指标。
   - 阶段 C：全量开放，并开启监控报警。
3. **回滚方案**：
   - 若发生严重问题，关闭前端入口并通过 flag 将 Feed 回退到 `latest`
     默认排序；后端保留 API 以保证兼容。

---

## 12. 风险与缓解

| 风险                          | 等级   | 缓解措施                                                |
| ----------------------------- | ------ | ------------------------------------------------------- |
| Redis 未配置导致限流退化      | 中     | 部署 checklist 强制检测变量，日志告警提示               |
| Feed `following` 空态体验欠佳 | 低     | 新增空态引导与推荐模块 fallback                         |
| 批量状态查询高频导致性能下降  | 中     | 限制批量大小（<=50），引入本地缓存，监控结果            |
| 审计日志增长                  | 低     | 与现有日志策略一致，保持 30 天 retention                |
| **前端状态同步不一致**        | **中** | **使用 SWR 全局 mutate + 乐观更新 + revalidateOnFocus** |
| **批量查询 N+1 问题**         | **中** | **实现批量状态查询 API，限制批量大小≤50**               |

### 12.1 前端状态同步风险（新增）

**风险描述**：关注/取关操作后，多个页面（Feed、Profile、Settings）的状态可能不同步，导致 UI 不一致。

**影响**：

- 用户在 Feed 页面关注某人后，切换到 Settings 页面仍显示"未关注"
- 关注数统计不准确
- 用户体验混乱

**缓解措施**：

1. **全局缓存刷新**：使用 SWR 的 `globalMutate` 机制，关注操作后刷新所有相关缓存

   ```typescript
   // 在 useFollowUser Hook 中
   const mutateCacheKeys = [
     "/api/users/suggested",
     "/api/activities",
     "/api/users/follow/status",
   ]
   ```

2. **乐观更新**：立即更新 UI，失败时回滚

   ```typescript
   optimisticUpdate(userId, true) // 关注操作前
   rollbackOptimisticUpdate(userId, wasFollowing) // 失败时回滚
   ```

3. **关键页面重新验证**：使用 `revalidateOnFocus` 确保数据新鲜度
   ```typescript
   const { data } = useSWR(key, fetcher, {
     revalidateOnFocus: true, // 页面获得焦点时重新验证
   })
   ```

### 12.2 批量查询性能风险（新增）

**风险描述**：在用户列表页面（如推荐用户、搜索结果）需要批量查询关注状态，可能导致 N+1 查询问题。

**影响**：

- 页面加载缓慢（每个用户一次查询）
- 数据库查询压力大
- 用户体验下降

**缓解措施**：

1. **实现批量状态查询 API**：`POST /api/users/follow/status`

   ```typescript
   // 请求体
   { targetIds: ['user1', 'user2', 'user3'] }

   // 响应
   {
     'user1': { isFollowing: true },
     'user2': { isFollowing: false },
     'user3': { isFollowing: true }
   }
   ```

2. **在前端使用批量查询 Hook**：

   ```typescript
   const userIds = users.map(u => u.id)
   const { statusMap } = useFollowStatusBatch(userIds, currentUser?.id)

   // 渲染时直接使用
   {users.map(user => (
     <FollowButton
       targetUserId={user.id}
       initialFollowing={statusMap[user.id]?.isFollowing}
     />
   ))}
   ```

3. **设置合理的批量查询上限**：最多 50 个用户，超过则分批查询

---

## 13. 里程碑与任务拆解

| 序号 | 任务                                  | 拥有人   | 截止日期   |
| ---- | ------------------------------------- | -------- | ---------- |
| T1   | 建立 `follow` 服务层、单元测试        | Backend  | 2025-09-30 |
| T2   | 扩展 API 路由与契约测试               | Backend  | 2025-10-01 |
| T3   | 前端 `FollowButton` 组件化、Feed 集成 | Frontend | 2025-10-02 |
| T4   | 粉丝/关注列表页面 & 钩子              | Frontend | 2025-10-04 |
| T5   | 监控脚本与 Dashboard 更新             | Platform | 2025-10-05 |
| T6   | E2E 测试、灰度计划回顾                | QA       | 2025-10-06 |

---

## 14. 双栈架构说明（API + Server Action）

### 14.1 设计决策

关注系统采用**双栈调用模式**，同时提供 REST API 和 Next.js Server
Action 两种调用方式：

#### API 路由（`/api/users/[userId]/follow`）

- **适用场景**：外部客户端、移动端、第三方集成
- **优势**：标准 HTTP 接口，易于调试和监控
- **实现位置**：`app/api/users/[userId]/follow/route.ts`

#### Server Action（`lib/actions/follow.ts`）

- **适用场景**：Next.js 服务端组件、表单提交、渐进增强
- **优势**：类型安全、无需手动序列化、自动 CSRF 保护
- **实现位置**：`lib/actions/follow.ts`

### 14.2 共享逻辑层

为避免代码重复，两种调用方式共享以下核心逻辑：

1. **服务层**（`lib/interactions/follow.ts`）：
   - `toggleFollow`: 幂等关注/取关操作
   - `listFollowers` / `listFollowing`: 游标分页列表
   - `batchCheckFollowStatus`: 批量状态查询

2. **中间件层**（`middleware.ts`）：
   - CSRF 校验
   - 速率限制（API 和 Server Action 共享配额）
   - 来源校验

3. **审计层**（`lib/audit-log`）：
   - 统一的操作日志记录
   - 请求 ID 追踪

### 14.3 使用最佳实践

#### 前端组件选择指南

```typescript
// ✅ 推荐：在客户端组件中使用 API 调用
"use client"
import { useFollowUser } from "@/hooks/use-follow-user"

function FollowButton({ userId }: { userId: string }) {
  const { followUser, isLoading } = useFollowUser()
  return <button onClick={() => followUser(userId)}>关注</button>
}

// ✅ 推荐：在服务端组件/表单中使用 Server Action
import { toggleFollowAction } from "@/lib/actions/follow"

function FollowForm({ userId }: { userId: string }) {
  return (
    <form action={toggleFollowAction}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit">关注</button>
    </form>
  )
}
```

#### 错误处理一致性

两种调用方式返回相同的错误码和消息格式：

```typescript
// API 响应
{
  "success": false,
  "error": {
    "code": "ALREADY_FOLLOWING",
    "message": "已经关注该用户"
  }
}

// Server Action 响应
{
  success: false,
  error: {
    code: "ALREADY_FOLLOWING",
    message: "已经关注该用户"
  }
}
```

### 14.4 监控与调试

- **API 调用**：通过 `performanceMonitor.recordMetric` 记录
  `FOLLOW_ACTION_DURATION`
- **Server Action**：共享相同的指标类型，便于统一监控
- **审计日志**：两种调用方式都记录 `USER_FOLLOW_ACTION` 事件

---

## 15. 客户端 Hook 测试策略

### 15.1 测试层次

#### 单元测试（`tests/hooks/use-follow-user.test.ts`）

测试 Hook 的核心逻辑，包括：

- ✅ 乐观更新机制
- ✅ 错误回滚
- ✅ 缓存刷新触发
- ✅ 并发请求去重

**关键测试技巧**：

```typescript
// 使用 renderHook 测试 Hook
import { renderHook, waitFor } from "@testing-library/react"
import { useFollowUser } from "@/hooks/use-follow-user"

it("应该在成功后刷新缓存", async () => {
  const mockMutate = vi.fn()
  const { result } = renderHook(() =>
    useFollowUser({
      mutateCacheKeys: ["/api/users/suggested"],
    })
  )

  await result.current.followUser("user-123")

  await waitFor(() => {
    expect(mockMutate).toHaveBeenCalledWith("/api/users/suggested")
  })
})
```

#### 集成测试（`tests/integration/follow-flow.test.ts`）

测试 Hook 与真实 API 的交互：

- ✅ 完整的关注/取关流程
- ✅ 速率限制处理
- ✅ 认证失败场景

#### 组件测试（`tests/components/follow-button.test.tsx`）

测试 UI 组件与 Hook 的集成：

- ✅ 按钮状态切换
- ✅ 加载状态显示
- ✅ Toast 提示触发

### 15.2 测试环境配置

**关键配置**（`vitest.config.ts`）：

```typescript
export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
  },
})
```

**测试环境特殊处理**：

```typescript
// create-follow-user.ts 中的测试环境检测
if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  // 跳过缓存刷新，避免 act() 无限等待
  return
}
```

### 15.3 Mock 策略

#### Mock SWR Mutate

```typescript
const mockMutate = vi.fn().mockResolvedValue(undefined)
vi.mock("swr", () => ({
  useSWRConfig: () => ({ mutate: mockMutate }),
}))
```

#### Mock Toast API

```typescript
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
}
```

#### Mock Logger

```typescript
const mockLogger = {
  warn: vi.fn(),
  error: vi.fn(),
}
```

### 15.4 覆盖率目标

- **行覆盖率**：≥ 85%
- **分支覆盖率**：≥ 70%
- **关键路径**：100%（关注/取关/错误处理）

---

## 16. 结论

现有架构、数据层与测试基线已满足关注系统的启动条件。本设计方案通过复用既有统一服务层与 Next.js 路由，聚焦最小实现路径，实现关注关系管理与关注流体验，同时兼顾监控与可回滚性。

**双栈架构**（API + Server
Action）提供了灵活的调用方式，既满足外部集成需求，又充分利用 Next.js 的类型安全优势。通过共享服务层和中间件，确保两种调用方式的行为一致性。

**客户端 Hook 测试策略**确保了前端交互的稳定性和可维护性，通过分层测试覆盖单元、集成和组件三个层次。

按上述里程碑执行，可在 Phase 9 内完成关注系统上线且不破坏现有用户体验。
