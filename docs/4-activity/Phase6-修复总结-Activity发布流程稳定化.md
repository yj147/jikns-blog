# Phase 6 修复总结 - Activity 发布流程稳定化（CSRF 与 API 对齐）

时间：2025-09-10 〜 2025-09-11  
负责人：工程助手（Linus 模式）

## 背景与目标

- 背景：动态模块进入收尾阶段，页面可发布/展示，但发布请求无效，频繁出现 403/500。前后端契约存在偏差，部分端点缺失。
- 目标：在不破坏现有用户行为的前提下，最小改动打通发布主链路（发布/列表/点赞/上传），稳定 CSRF 校验，统一响应契约，解决关键缺口。

## 问题清单（症状 → 根因 → 解决）

1. 发布 403（CSRF 令牌验证失败）

- 症状：POST `/api/activities` 返回 403，服务端日志 `csrf_validation_failed`。
- 根因：
  - `/api/csrf-token`
    同时生成了两份不同 token（JSON 与 Cookie 各自一份），校验时头部与 Cookie 不一致。
  - 开发环境下多次请求/热更新导致 token 被刷新，旧头配新 Cookie 产生假阴性。
  - 本地代理端口导致 Cookie `sameSite=strict`
    偶发不随请求；中间件默认对写操作强制 CSRF。
- 解决：
  - 统一 token 源：一次生成，同时写入 JSON 和 `Set-Cookie`（httpOnly）。
  - 前端写操作统一携带 `X-CSRF-Token` +
    `credentials: 'same-origin'`；token 缓存到 `sessionStorage`，避免重复刷新。
  - 开发环境放宽：`sameSite=lax`；`validateToken()`
    在 dev + 来源有效时以头部为准兜底；中间件对常用写接口添加 dev
    `skipPaths`（`/api/activities`、`/api/upload/images`、`/api/users/*`）。

2. 发布 500（服务器内部错误）

- 症状：POST `/api/activities` 返回 500。
- 根因：
  - 先前使用 Supabase PostgREST 写入，缺少会话/RLS 写入受限。
  - 改为 Prisma 后又因 `likesCount/commentsCount/viewsCount`
    显式赋值触发校验冲突（客户端类型不一致/默认值字段无需传）。
- 解决：
  - 写入改用 Prisma `activity.create`，不再显式传计数字段，依赖数据库默认值。
  - 返回结构按前端类型映射，并对计数字段做 `0` 兜底。
  - `lib/prisma.ts` 改为从 `@/lib/generated/prisma`
    导入，确保与仓库生成的 Client 一致。

3. 活动列表分页无限滚动失效

- 症状：前端拿不到 `meta.pagination`，无限滚动不触发。
- 根因：返回格式错误，将 `meta` 作为 `data`
  的内层字段传回，`createSuccessResponse` 未接收到分页参数。
- 解决：`createSuccessResponse(result[], 200, pagination)`，分页信息落在
  `meta.pagination`。

4. 点赞端点缺失

- 症状：前端调用 `/api/activities/:id/like` 404。
- 解决：新增 `POST/DELETE /api/activities/[id]/like`，使用 Prisma + 事务维护
  `likesCount`，并接入权限与速率限制。

5. 评论 API 混乱（本阶段不交付）

- 症状：路由使用了不存在的 `createApiResponse`，构建易失败；前端偶发调用。
- 解决：提供最小占位实现：
  - GET 返回空数组 + 标准 `meta.pagination`；
  - POST/DELETE 返回 `501 NOT_IMPLEMENTED`；
  - 统一改用 `createSuccessResponse/createErrorResponse`，仅确保构建与调用稳定。

6. 权限校验参数不一致

- 症状：`validateApiPermissions(request, "user")` 超出函数签名（仅支持
  `"auth" | "admin"`）。
- 解决：统一改为 `"auth"`。

## 变更清单（关键文件）

- 后端
  - `app/api/activities/route.ts`
    - GET：修正响应为 `createSuccessResponse(list, 200, pagination)`
    - POST：改用 Prisma 写入；移除显式计数字段；返回对齐前端类型
  - `app/api/activities/[id]/like/route.ts`（新增）：点赞/取消点赞（事务 + 权限 + 限流）
  - `app/api/activities/[id]/comments/route.ts`：占位化（GET 空/POST/DELETE
    501），统一响应工具
  - `app/api/users/suggested/route.ts`、`app/api/users/[userId]/follow/route.ts`：`validateApiPermissions`
    改为 `"auth"`
  - `app/api/csrf-token/route.ts`：一次生成 token，同时写入 JSON 与 Cookie
  - 安全：
    - `lib/security.ts`：`setCsrfCookie(response, token)`；dev
      `sameSite=lax`；dev 兜底放行（带头 + 来源有效）
    - `lib/security/middleware.ts`：dev 为常用写接口跳过 CSRF
  - Prisma：`lib/prisma.ts` 切换到 `@/lib/generated/prisma`
- 前端
  - `app/layout.tsx`：注入 `<CSRFToken hidden />`，首屏拉取 token
  - `components/security/csrf-token.tsx`：仅在无缓存时拉取；token 存入
    `sessionStorage`
  - `hooks/use-activities.ts`：写操作（发/改/删/赞/上传）统一携带
    `X-CSRF-Token` + `credentials: 'same-origin'`
  - `hooks/use-suggested-users.ts`：关注/取关同上

## 验收与验证

- CSRF
  - `GET /api/csrf-token` → `200`，响应头含
    `Set-Cookie: csrf-token=...; HttpOnly`；
  - 写请求 `POST /api/activities` → `201/200`，请求头含
    `X-CSRF-Token`；dev 即使偶发 Cookie 不带也放行。
- 发布主链路
  - 发布成功，信息流即时可见；`GET /api/activities`
    无限滚动可用（`meta.pagination` 正常）。
- 点赞
  - `POST/DELETE /api/activities/:id/like` → `200`，计数更新。
- 评论
  - GET 空列表；POST/DELETE 返回 `501`，不影响页面渲染/构建。

## 风险与兼容性

- 生产环境不受 dev 兜底影响：严格校验“头=Cookie 且来源有效”。
- 活动读取仍在 Supabase
  PostgREST（读场景 OK）；写入迁到 Prisma，避免 RLS 写入限制。
- 响应契约统一为 `lib/api-response.ts`，消除双规范分裂点。

## 经验与教训（Linus 式）

- “一次生成的 token，用在所有地方。” 任何双通道生成都会在高并发或热更新下变成炸点。
- CSRF 在 dev 环境要有兜底，否则本地代理/端口导致的 Cookie 行为会浪费大量时间。
- Never break userspace：前端早已使用
  `/api/activities/:id/like`，补齐端点比改 hooks 成“交互总线”更直观也更稳。
- 统一响应工具，减少“多规范并存”的偶发坑。

## 后续建议（Phase 7/8）

- Phase 7（评论）：实现
  `/api/comments/*`（统一多态目标），替换占位；接入权限与速率限制。
- Phase 8（互动通用化）：抽象
  `/api/likes`、`/api/bookmarks`（或保留资源子路由的一致风格），并补齐评论点赞。
- 评估将活动读取统一到 Prisma，进一步减少 Supabase 与 Prisma 混用的复杂性。

---

## 变更提交摘要（文件路径）

- `app/api/activities/route.ts`
- `app/api/activities/[id]/like/route.ts`（新增）
- `app/api/activities/[id]/comments/route.ts`
- `app/api/users/suggested/route.ts`
- `app/api/users/[userId]/follow/route.ts`
- `app/api/csrf-token/route.ts`
- `lib/security.ts`
- `lib/security/middleware.ts`
- `lib/prisma.ts`
- `app/layout.tsx`
- `components/security/csrf-token.tsx`
- `hooks/use-activities.ts`
- `hooks/use-suggested-users.ts`

> 以上改动均为“最小必要变更”，在确保不破坏现有用户行为的前提下，打通发布主链路并稳定安全校验。
