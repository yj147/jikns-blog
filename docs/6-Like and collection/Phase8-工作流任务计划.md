# Phase 8 - 点赞与收藏系统 工作流任务计划

状态: 规划完成（待执行）范围: Likes（文章/动态）+
Bookmarks（文章），统一服务层与 API 契约，保持兼容。

## 0. 执行摘要

- 核心目标：在不修改现有数据库模型的前提下，补齐收藏统一服务层与 API，完善点赞契约与测试，统一前端接入，并维持历史入口与 Server
  Actions 的兼容性。
- 风险控制：严格遵循 unified-auth/unified-response；旧入口仅做“委托”，不移除；默认关闭限流；隐私优先（收藏列表仅本人/ADMIN）。

## 1. 交付物与DoR

Definition of Ready ✅

- 设计文档：docs/6-Like and collection/点赞收藏-技术设计.md（已提交）
- 数据模型：Prisma Like/Bookmark 已就绪；无需迁移
- 依赖：评论系统（Phase 7）完成；认证/响应工具 unified-\* 就绪

核心交付物 📦

- 后端：
  - `lib/interactions/bookmarks.ts`（toggle/status/list）
  - `/app/api/bookmarks/route.ts`（GET status/list，POST toggle）
  - `/app/api/likes/route.ts` 契约补全与测试完善
  - 兼容：`/api/user/interactions` 与 `app/actions/post-actions.ts`
    改为委托服务层
  - `app/api/posts/route.ts` 增补 `_count.bookmarks`
- 前端：
  - 博客详情页收藏按钮接入新 API
  - 个人中心收藏列表接入新 API（支持 `userId=me`）
- 测试：服务层 + API + 组件完整用例，覆盖率达标
- 文档：API 契约、迁移说明、命令速查

## 2. 任务分解（按优先级）

BE-1: 收藏服务层（P0）

- 新增 `lib/interactions/bookmarks.ts`：
  - `toggleBookmark(postId: string, userId: string) → { isBookmarked, count }`
  - `getBookmarkStatus(postId: string, userId?: string) → { isBookmarked, count }`
  - `getUserBookmarks(userId: string, { cursor?, limit? }) → { items, hasMore, nextCursor }`
- 仅返回已发布 Post；select 最小必要字段；按 `createdAt desc` 分页。

BE-2: 收藏 API 路由（P0）

- 新增 `app/api/bookmarks/route.ts`：
  - GET `?action=status&postId=...`
    → 状态与计数（匿名可查 count，登录返回 isBookmarked）
  - GET `?action=list&userId=(ID|me)&cursor&limit`
    → 仅本人/ADMIN；仅发布文章；含 pagination
  - POST `{ postId }` → 切换收藏；`withApiAuth('user-active')`
- 统一错误码与响应：`unified-response`；审计日志接入。

BE-3: 点赞 API 契约完善（P0）

- `/app/api/likes/route.ts`：
  - 确认 GET status/users、POST toggle 与文档一致；
  - 如缺失 users 列表分页元数据/字段一致性，补齐；
  - 增补集成测试。

BE-4: 兼容入口委托（P0）

- `app/api/user/interactions/route.ts`：like/bookmark 分支调用服务层；保留旧响应包装（Deprecated 注释）。
- `app/actions/post-actions.ts`：like/bookmark 改为服务层委托；对外签名/消息不变。

BE-5: posts API 统计补齐（P0）

- `app/api/posts/route.ts`：select
  `_count: { comments, likes, bookmarks }`，对齐 `types/blog.ts::PostStats`。

BE-6: 限流与配置（P1，可选）

- 比照
  `lib/rate-limit/comment-limits.ts`，新增 likes/bookmarks 的限流模块（或占位）；默认
  `ENABLED=false`；文档列出 env。

FE-1: 博客详情页（P0）

- 收藏按钮：查询 `/api/bookmarks?action=status`，切换走
  `POST /api/bookmarks`；UI 与计数同步；失败回滚。

FE-2: 个人中心-收藏列表（P0）

- 使用 `/api/bookmarks?action=list&userId=me`；分页组件对齐；空态与错误态。

QA-1: 服务层单元测试（P0）

- likes：toggle/status/users/count；重复操作、目标不存在、匿名等；
- bookmarks：toggle/status/list；未发布文章、权限、空列表、分页；

QA-2: API 集成测试（P0）

- `/api/bookmarks`：status/list/toggle 全路径与错误分支；
- `/api/likes`：status/users/toggle 全路径回归；
- `/api/user/interactions`：like/bookmark 分支回归契约（兼容保证）。

QA-3: 组件测试（P1）

- 博客详情点赞/收藏按钮：登录/未登录、乐观更新、失败回滚、状态一致性（与服务返回）。

DOC-1: 文档与迁移说明（P0）

- 更新 Phase 8 设计与完成报告；
- API 契约示例、隐私策略说明（收藏仅本人/ADMIN）、`userId=me` 语法糖；
- 兼容策略与弃用计划。

## 3. 序列与里程碑

Milestone A（后端能力就绪）

- 完成 BE-1/2/3/4/5（收藏服务/路由，点赞契约回归，兼容委托，posts 统计）；
- 核验：服务层/路由单元+集成测试通过；

Milestone B（前端接入与QA）

- 完成 FE-1/2 与 QA-1/2/3；
- 覆盖率达标（lines ≥85%，branches ≥70%）。

Milestone C（收尾与文档）

- 完成 DOC-1，输出完成报告；
- 可选：BE-6 限流模块落地与禁用配置验证。

## 4. 验收标准（DoD）

- 功能：
  - `/api/bookmarks` 提供 status/list/toggle，权限与隐私符合策略；
  - `/api/likes` 按契约工作，users 列表分页元数据正确；
  - posts 列表/详情包含 `bookmarksCount`；
- 质量：
  - Vitest 覆盖率 ≥ 85% lines，≥ 70% branches；
  - Lint/TypeCheck/Format 通过（`pnpm quality:check`）；
- 兼容：
  - `/api/user/interactions` 与 Server Actions 行为一致；
  - 旧路由未被移除，内部委托，外部无感；
- 性能：
  - 关键查询 P95 < 200ms（本地基线），无明显 N+1；
- 安全：
  - 未登录仅能读公开状态；收藏列表仅本人/ADMIN；
  - 限流默认关闭，开关有效；

## 5. 风险与缓解

- 多套 API 工具并存 → 新代码强制 unified-\*；旧入口仅委托（不改对外响应），渐进收敛。
- 隐私泄露风险（收藏列表）→ 路由强校验 userId 与当前用户；仅 ADMIN 可读取他人列表。
- 统计一致性问题 →
  Activity 冗余计数与 Post 聚合保持既有策略，不跨域相互写入；测试覆盖计数路径。
- 兼容入口差异 → 合同测试覆盖（mock/真实），避免细节漂移。

## 6. 时间与资源预估（理想工期 2–3 天）

- Day 1：BE-1/2/5；likes 契约核对；基础测试（单位/集成）
- Day 2：BE-3/4 完成；FE-1/2 接入；QA-1/2/3
- Day 3：BE-6（可选）；完善文档与收尾；稳定性与性能校验

## 7. 成功指标

- 覆盖率达标；新增/回归测试 100% 通过
- E2E 关键路径（文章详情点赞/收藏、个人收藏列表）走通
- 无破坏性反馈（CI/CD 与手动验收均通过）

## 8. 环境变量（建议，默认关闭）

- LIKES_RATE_LIMIT_ENABLED=false
- LIKES_RATE_LIMIT_WINDOW_MS=60000
- LIKES_RATE_LIMIT_TOGGLE_USER=60
- LIKES_RATE_LIMIT_TOGGLE_IP=120
- BOOKMARKS_RATE_LIMIT_ENABLED=false
- BOOKMARKS_RATE_LIMIT_WINDOW_MS=60000
- BOOKMARKS_RATE_LIMIT_TOGGLE_USER=30
- BOOKMARKS_RATE_LIMIT_TOGGLE_IP=60

## 9. 命令速查

```bash
# 单元测试（收藏/点赞服务层）
pnpm vitest run tests/unit/bookmarks-service.test.ts tests/unit/likes-service.test.ts

# API 契约测试（点赞/收藏路由）
pnpm vitest run tests/api/bookmarks-route.test.ts tests/api/likes-route.test.ts

# 端到端验证（启动 `pnpm dev` 后执行）
pnpm test:e2e tests/e2e/interactions.spec.ts

# 质量检查
pnpm quality:check

# 开发服务器（E2E 前置）
pnpm dev
```

---

Linus 式补充：别重构没坏的东西。最简单的路径是对的路径——新增 bookmarks 能力、统一契约、严守兼容，不搞“完美抽象”。

## 10. 验证清单（限流 & 分页）

- **点赞/收藏限流（Redis 可选）**
  1. 设置 `LIKES_RATE_LIMIT_ENABLED=true` /
     `BOOKMARKS_RATE_LIMIT_ENABLED=true`，如有 Upstash 凭证同步配置
     `UPSTASH_REDIS_REST_URL/TOKEN`；
  2. 连续执行 `pnpm vitest run tests/unit/toggle-rate-limits.test.ts`
     观察 Redis/内存回退场景全绿；
  3. 在本地或 Staging 通过 `curl`/Thunder 连续触发 `/api/likes`，确认 `429`
     响应附带 `retryAfter`，并在监控面板看到 backend=redis 统计。
- **分页稳定性**
  1. 运行
     `pnpm vitest run tests/unit/bookmarks-service.test.ts tests/unit/likes-service.test.ts`，确认同秒游标用例绿灯；
  2. QA 手动准备同时间戳数据（脚本 `scripts/db:seed` 或 Prisma Studio），调用
     `/api/likes?action=users` 与 `/api/bookmarks`，校验 `nextCursor`
     单调递减且无跳项。
