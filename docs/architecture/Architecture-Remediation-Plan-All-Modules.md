# 全模块架构修复方案（取代 Phase6-8 的局部范围）

**版本**: 1.0  
**日期**: 2025-09-11  
**状态**: 提案（覆盖 0-foundations / 1-database / 2-auth / 3-posts /
4-activity）

> 本文为“全项目”架构修复方案，聚焦当前已实现模块与既有代码的对齐与收敛。此前的
> `Architecture-Remediation-Plan-Phase6-8.md`
> 仅覆盖 activity 与后续模块，范围过窄，现由本方案取代其作为主方案；原文档可保留为 activity 子域参考材料。

---

## 0. 原则与目标

- Never break
  userspace：禁止破坏现有 API、行为与数据约定，采用兼容迁移与薄封装。
- 简化优先：消除特殊分支与重复路径，统一“服务层 + 契约 + 中间件”三件套。
- 文档→实现闭环：以 docs 中的架构/数据库/需求为北极星，落到 `app/`、`lib/`
  的可操作项。

目标（4 周内分批完成）：

- 统一认证/权限/响应风格，消除重复工具与不一致的安全姿态。
- 统一交互（评论/点赞）为通用服务层，保留旧路由薄封装，避免破坏现有调用。
- 对 posts/activity 的读写路径与缓存策略进行一致化与最小化差异处理。
- 建立性能与可观测基线（端到端），完善关键用例测试闭环。

---

## 1. 模块现状与差距（基于 docs 与代码）

- Database（prisma/schema.prisma）
  - 与 docs 设计一致：双核（Post/Activity）、通用交互（Comment/Like）、收藏/关注、索引齐备。
  - 机会：计数冗余字段（likesCount/commentsCount 等）在 Activity 已出现，Post 侧暂无缓存策略统一说明。

- Auth/权限（`app/api/auth/*`, `@/lib/auth*`, `@/lib/permissions*`,
  `middleware.ts`）
  - 已有：登录/注册/登出、admin-check，中间件保护；组件层 `components/auth/*`。
  - 差异：API 中存在 `withApiAuth` 与 `getCurrentUser` 并用；`@/lib/api-guards`
    与 `@/lib/api-response` 两套响应工具并存。

- Posts（`app/api/posts`, `app/api/admin/posts`, `app/admin/blog/*`,
  `@/lib/actions/posts.ts`）
  - 已有：公开查询、管理员 CRUD、标签 connectOrCreate、发布/撤回、SEO 字段。
  - 差异：交互统一层（评论/点赞）尚未接入；缓存/ETag/ISR 策略未统一记录。

- Activity（`app/api/activities*`, `@/components/activity/*`,
  `@/lib/rate-limit/activity-limits.ts`）
  - 已有：GET 使用 Supabase，POST 使用 Prisma；限流、权限校验、XSS 处理。
  - 差异：读写路径混杂（Supabase +
    Prisma），与 posts 在数据访问与缓存策略上不一致。

- 交互（评论/点赞）
  - 现状：仅见 activity 子域下的路由（`/api/activities/[id]/(comments|like)`），posts 侧缺口；未形成通用交互层。

- 工具与中间件（`@/lib/security*`, `@/lib/error-handling/*`,
  `@/lib/utils/logger`）
  - 已有：XSS、防重复、错误边界、日志工具等。
  - 差异：响应/错误工具重复；日志/审计规范未统一到“操作级语义 + 关键信息”模板。

---

## 2. 修复蓝图（按域分层）

### 2.1 基础与横切（0-foundations）

- 统一响应与错误：
  - 目标：项目仅保留 `@/lib/api-response`（或 `api-guards` 二选一）。
  - 措施：提供兼容导出层，逐步将存量 API 收敛到同一工厂函数（`createSuccessResponse/createErrorResponse`）。
- 统一认证鉴权：
  - 目标：服务端仅使用一种姿态：`withApiAuth`（支持角色/状态策略），RSC/SA 使用统一
    `getCurrentUser`。
  - 措施：在 `@/lib/auth` 暴露一致 API；旧调用通过薄适配层过渡。
- 统一安全链：
  - XSS 清理：集中入口（参数→业务层前）；
  - 速率限制：统一中间件签名；
  - CSRF：统一在有状态写操作端点启用。
- 性能与可观测：
  - 统一日志字段：`operation`, `actor`, `target`, `resource`, `latency`,
    `status`；
  - 添加端到端性能埋点与关键查询指标（posts list / feed / post detail / create
    activity）。

### 2.2 数据库与数据一致性（1-database）

- 索引审视：验证 posts 的 `publishedAt desc` 路径，确保与公开列表排序一致；
- 计数缓存：为 Post 侧定义与 Activity 一致的计数缓存策略（是否需要、如何更新、读写一致保证）。
- 迁移策略：仅 Schema First、无破坏字段；新增通过可空列与后填充迁移实现。

### 2.3 认证与权限（2-auth）

- 统一用户态获取：`getCurrentUser` 返回 `role/status`，API 封装
  `withApiAuth(policy)`：`policy in ['admin','user-active','any']`。
- 路由保护基线：
  - 管理端：`/app/admin/*` → ADMIN；
  - 动态/交互写：ACTIVE；
  - 公开读：ANY。

### 2.4 博客文章系统（3-posts）

- API 契约稳定：
  - `/api/posts` 公开读（分页、搜索、标签/系列筛选）；
  - `/api/admin/posts` 管理写（CRUD + 发布/撤回）。
- 交互接入：在 posts 详情页接入统一评论/点赞组件，接口走通用交互层。
- 缓存策略：公开读提供 `ETag/Cache-Control`
  与 ISR 说明，避免与 Activity 侧行为不一致。

### 2.5 动态系统（4-activity）

- 读写一致：选型其一（保持兼容前提）：
  - A 案：读写全部走 Prisma（统一 data path）；
  - B 案：读走 Supabase，写走 Prisma（保留现状），但抽象出 `ActivityRepo`
    层，隐藏差异。
- 统一交互层接入：同 posts。
- 性能：游标分页、置顶排序二级键一致；限流与内容清理前置化。

### 2.6 统一交互层（评论/点赞，跨 posts/activity）

- 服务层（`@/lib/interactions/*`）：
  - `createComment(targetType, targetId, content, author)`
  - `listComments(targetType, targetId, cursor|page)`
  - `toggleLike(targetType, targetId, author)` / `countLikes(...)`
  - 校验：幂等（Like 唯一键），XSS 清理，权限：ACTIVE。
- 路由层（新增，保持兼容）：
  - 新：`/api/comments`，`/api/likes`（参数
    `targetType: 'post'|'activity'`，`targetId`）。
  - 旧：`/api/activities/[id]/comments|like` → 薄封装转调统一服务（不移除）。

---

## 3. 渐进式迁移计划（零破坏）

- Phase A（基础收敛，W1）
  - 确认并保留唯一响应工厂；构建 `withApiAuth` 策略函数；补日志字段模板。
  - 建立 `ActivityRepo` 与 `PostsRepo` 抽象，隐藏读写数据源差异。

- Phase B（交互统一，W2）
  - 新增通用交互服务与路由；接入 Activity 端；测试覆盖：创建/列表/幂等。

- Phase C（Posts 接入，W3）
  - Posts 详情接入评论/点赞；公开读缓存策略与 ISR 对齐；E2E 用例补齐。

- Phase D（性能与观测，W4）
  - 加入端到端性能指标；日志聚合校验；热点查询索引核验；稳态压测与基线记录。

里程碑与兼容性：

- 每个 Phase 结束时，旧路由与旧行为保留；仅在调用侧迁移完成后考虑清理重复层。

---

## 4. 质量与测试

- 覆盖范围：
  - 单元：交互服务、权限策略、响应工厂；
  - 集成：posts 公开读、admin CRUD、activity 发布/列表、评论/点赞全链路；
  - E2E：登录→发动态→评论/点赞→查看文章详情→互动→注销。
- 目标：维持仓库既有阈值（lines ≥ 85%，branches ≥ 70%），关键流新增断言。

---

## 5. 明确的落地改动清单（第一批 PR）

- 新增：`@/lib/interactions/{comments,likes}.ts` 服务层与测试。
- 新增：`app/api/{comments,likes}/route.ts`（通用端点）。
- 兼容：`app/api/activities/[id]/{comments,like}/route.ts` → 转调统一服务。
- 收敛：统一到 `@/lib/api-response`（或
  `api-guards`），在另一处导出做桥接，逐步替换存量调用。
- 基线：抽象
  `ActivityRepo`，将 Supabase 读与 Prisma 写封装在仓储层；posts 同理。
- 文档：本文件落库；在 `Architecture-Remediation-Plan-Phase6-8.md`
  顶部加“范围说明与指向本方案”的提示。

---

## 6. 风险与回退

- 风险：响应/鉴权收敛期间的行为偏差；交互统一导致的隐蔽依赖暴露。
- 缓解：分层适配 + 旧路由保留 + 端到端回归用例；灰度在路由层按路径开关。
- 回退：保留旧实现路径与 feature flag，随时切换；数据库迁移仅新增不删改。

---

## 7. 结语

这是一份覆盖“当前已实现模块”的全局修复方案，遵循“简化优先、零破坏、可验证”的原则。后续模块（关注、标签等）应复用同一交互与权限骨架，避免再次产生平行实现与重复复杂度。
