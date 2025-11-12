# 评论系统 - 技术设计文档（Phase 7）

**版本**: 1.0  
**日期**: 2025-09-11  
**状态**: 可实施设计（与现有实现对齐，零破坏兼容）

---

## 1. 目标与范围

- 目标
  - 为文章(Post)与动态(Activity)提供统一评论能力：创建、列表、删除、嵌套回复（单层），XSS 清理，分页与游标，最小一致的计数策略。
  - 保持向后兼容（Activity 旧端点仍可用），不破坏现有调用（Never break
    userspace）。
- 非目标（后续演进）
  - 评论编辑功能
  - 评论点赞/举报/审核工作流
  - 富文本/图片评论

---

## 2. 现状与数据模型

- 数据模型（Prisma）摘要：`Comment`
  - 多态关联：`postId? | activityId?`（目标必须二选一）
  - 嵌套回复：`parentId?` 自引用（目前仅提供“单层回复”结构返回）
  - 关键索引：`postId`、`activityId`、`parentId`、`createdAt(desc)`、`authorId`
- 计数策略
  - Activity：维护 `commentsCount`
    冗余计数（增删时增减；仅硬删才减，软删不减）。
  - Post：不维护冗余计数，聚合查询获取（避免引入未在 Schema 定义的字段）。
- 软删策略
  - 若评论存在子回复：仅置 `content` 为“[该评论已删除]”（不递归删除）。
  - 若无子回复：硬删除记录。

---

## 3. 权限与安全

- 角色与状态
  - 创建/删除需登录且用户 `status=ACTIVE`。
  - 删除权限：作者本人或 `ADMIN`。
  - 读取评论：公开访问。
- 认证/鉴权实现
  - 统一认证
    `@/lib/api/unified-auth.ts`：`withApiAuth('user-active')`、`getCurrentUser()`。
  - 兼容旧实现通过薄封装转调统一服务层。
- 安全
  - XSS 清理：`@/lib/security/xss-cleaner.ts`（服务层在写入前统一清理）。
  - 速率限制：`@/lib/rate-limit/comment-limits.ts`（每用户/每IP维度；默认关闭，可通过环境变量启用）
    - 窗口策略：60秒滑动窗口
    - 创建评论：每用户 20/60s，每IP 60/60s
    - 删除评论：每用户 10/60s，每IP 30/60s
    - 开关控制：`COMMENTS_RATE_LIMIT_ENABLED=false`（默认）
  - CSRF：服务端路由（Route
    Handler）默认受同源策略保护；如未来开放跨域写入需统一 CSRF 校验。
  - 审计日志：关键操作记录到审计系统
    - 成功操作：`CREATE_COMMENT`、`DELETE_COMMENT`
    - 被拒操作：`*_DENIED`（含原因：RATE_LIMITED、FORBIDDEN、NOT_FOUND）

---

## 4. API 契约（统一入口 + 兼容入口）

- 统一入口（推荐）
  - `GET /api/comments`
    - Query
      - `targetType`: `post | activity`（必需）
      - `targetId`: string（必需）
      - `cursor`: string（可选，上一页最后一条评论的 `id`）
      - `limit`: number（默认10，最大100）
      - `includeReplies`:
        boolean（默认 false；true 时返回顶级评论 + 其直接子回复）
    - 响应（`@/lib/api/unified-response.ts`）
      - `data: CommentWithAuthor[]`
      - `meta.pagination: { page: 1, limit, total: -1, hasMore, nextCursor }`
  - `POST /api/comments`（需登录，ACTIVE）
    - Body
      - `targetType`: `post | activity`（必需）
      - `targetId`: string（必需）
      - `content`: string（必需，1–1000 字）
      - `parentId`: string（可选）
    - 响应：`data: CommentWithAuthor`
  - `DELETE /api/comments/[id]`（需登录，作者或 ADMIN）
    - Path: `id`（必需）
    - 响应：`data: { deleted: true }`
- 兼容入口（已在 Phase 2 下线，统一改用 `/api/comments`）
  - ~~`GET /api/activities/[id]/comments`~~
  - ~~`POST /api/activities/[id]/comments`~~
  - ~~`DELETE /api/activities/[id]/comments/[commentId]`~~
  - 如仍检测到外部调用，请迁移到新的统一路由。
- 错误码（统一枚举 `ErrorCode`）
  - `UNAUTHORIZED` 401，`FORBIDDEN` 403，`VALIDATION_ERROR` 400，`NOT_FOUND`
    404，`INTERNAL_ERROR` 500
  - `RATE_LIMIT_EXCEEDED` 429（新增，限流触发时返回）

---

## 5. 服务层与实现要点

- 服务层：`@/lib/interactions/comments.ts`
  - `createComment({ targetType, targetId, content, authorId, parentId? })`
    - 校验目标存在（Post/Activity 二选一）
    - XSS 清理 `content`
    - 创建记录；包含 `author { id, name, avatarUrl }` 选择
    - 若 `targetType=activity`：`commentsCount += 1`
  - `listComments({ targetType, targetId, cursor?, limit=10, includeReplies=false, includeAuthor=true })`
    - 顶级评论按 `createdAt desc`，`cursor=id` 游标，一次多取一条判断 `hasMore`
    - `includeReplies=true` 时二次查询 `parentId in [topIds]`，组装 `replies`
  - `deleteComment(commentId, userId, isAdmin=false)`
    - 非作者且非管理员拒绝；
    - 若有子回复 → 软删；否则硬删；
    - 仅硬删时对 Activity 目标 `commentsCount -= 1`
  - `getCommentCount(targetType, targetId)`
    - Post：直接 `count`；Activity：可以读取 `commentsCount` 或
      `count`（当前采用 `count` 以保持一致性与正确性）
- 事务与一致性
  - 单条增删对 Activity 计数使用单语句 `increment`；
  - 批量删除/清理（非本期）需包裹事务；
  - Post 侧不维护冗余，避免双写不一致。

---

## 6. 前端集成（基于现有组件）

- 复用与抽象
  - 现有：`components/activity/comment-list.tsx`（Activity 专用）。
  - 建议：抽象为通用组件 `components/comments/comment-list.tsx` 与
    `comment-form.tsx`：
    - Props：`{ targetType: 'post' | 'activity'; targetId: string }`
    - 数据来源：统一走 `/api/comments`（GET/POST/DELETE）
    - 功能：
      - 列表展示 + 游标分页 + 加载更多
      - 发表/回复 + XSS 清理提示
      - 删除（作者/管理员可见）
    - 兼容：Activity 页面保持旧组件路径，对内部实现改为通用组件封装
- 文章详情页接入（建议）
  - 在 `app/blog/[slug]/page.tsx` 注入评论区，最小改动适配；
  - 批量评论计数显示可通过 `getCommentCount` 聚合或在列表查询时回传
    `_count.replies`。

---

## 7. 性能与可观测

- 查询与索引
  - 顶级评论按 `createdAt desc` + `postId|activityId` 条件命中索引；
  - `includeReplies` 二次查询 `parentId in topIds` 命中 `parentId` 索引；
- 分页
  - 游标模式（`cursor=id`）避免深翻页偏移；
  - `limit` 最大 100，默认 10；
- 计数
  - Activity 使用冗余 `commentsCount`（写时增减）；
  - Post 使用 `count` 聚合（稳定正确）；
- 日志
  - 使用 `@/lib/utils/logger` 记录 `operation`：`CREATE_COMMENT` /
    `LIST_COMMENTS` / `DELETE_COMMENT`，输出 `actor/target/latency/status`；
- 监控（后续）
  - 为评论 API 加指标埋点：QPS、错误率、P95 延迟；
  - 慢查询审计（count 热点路径）。

---

## 8. 验证与测试

- 单元测试（服务层）
  - `createComment`：目标不存在、XSS 清理、父评论不匹配、Activity 计数 +1
  - `listComments`：分页/游标、含/不含 `replies`、作者信息选择
  - `deleteComment`：作者/管理员权限、软删/硬删分支、Activity 计数 -1（硬删）
- 集成测试（API）
  - `/api/comments`：GET/POST/DELETE 全路径；错误码断言（401/403/400/404）
  - 兼容层：`/api/activities/[id]/comments*` 行为一致
- E2E
  - 登录→发动态→评论→回复→删除评论（含软删/硬删）→注销

---

## 9. 兼容策略与迁移

- 现状兼容
  - Activity 旧路由保留，作为统一服务的薄封装；
  - 新老路由同源同语义，不影响现有客户端。
- 迁移建议
  - 新功能、新页面一律走统一路由 `/api/comments`；
  - 两个小版本后考虑逐步在内部弃用旧路径。

---

## 10. 开放问题与后续路线

- 速率限制：建议按 IP + User 双维度，窗口与阈值后续以压测结果调优。
- 审核与举报：后续引入 `status` 字段与审核队列，不影响现有表结构（新增可空列）。
- 编辑评论：需新增 `updatedAt` 展示与编辑审计；与软删策略并存。
- 前端富文本：需强化 XSS 白名单与内容降级策略。

---

## 11. 参考实现（代码路径）

- 服务层：`@/lib/interactions/comments.ts`
- 统一路由：
  - `GET/POST /api/comments` → `app/api/comments/route.ts`
  - `DELETE /api/comments/[id]` → `app/api/comments/[id]/route.ts`
- 兼容路由（Activity）：
  - `GET/POST /api/activities/[id]/comments` →
    `app/api/activities/[id]/comments/route.ts`
  - `DELETE /api/activities/[id]/comments/[commentId]` →
    `app/api/activities/[id]/comments/[commentId]/route.ts`
- 安全/认证：`@/lib/api/unified-auth.ts`、`@/lib/security/xss-cleaner.ts`
- 日志：`@/lib/utils/logger.ts`

---

## 12. DoD（完成定义）

- 评论创建/列表/删除在 Post 与 Activity 场景均工作正常；
- 软删/硬删、权限边界与错误码符合设计；
- 统一路由接口契约稳定，兼容路由行为一致；
- 服务层单元 + API 集成 + 一条端到端用例通过；
- 文档与代码注释更新；不破坏既有行为。
