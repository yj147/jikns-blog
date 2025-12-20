# 架构修复方案（Phase 6→8）

> 范围提示：本文件仅针对 Activity 模块及后续未开发子域的修复方案。全项目范围（覆盖 0-foundations
> / 1-database / 2-auth / 3-posts / 4-activity）的主方案已发布于
> `docs/Architecture-Remediation-Plan-All-Modules.md`，请以主方案为准，本文件作为 Activity 子域的实现细化参考。

版本：v1.1  
时间：2025-09-15  
作者：工程助手（Linus 模式）

## 更新记录

- 2025-09-15：P1 第二批任务完成，更新进度状态

## 0. 目标与原则

- 目标：在不破坏现有用户行为（Never break
  userspace）的前提下，修复"数据访问分裂、认证与安全堆叠、响应契约双轨"等核心架构问题，稳定 Activity 模块主链路，并为 Phase
  7/8（评论/互动通用化）夯实基础。
- 原则：
  - 单一事实来源（Single Source of
    Truth）：数据访问统一；响应规范统一；CSRF 仅服务端生成。
  - 渐进收敛：先修 P0（发布主链路/契约/安全），再做 P1（统一化），最后 P2（性能/可运维化）。
  - 最小改动、可回滚：分 PR、小批量，提供开关与回滚点。

---

## 1. 总体路线图

### 进度状态 (2025-09-15)

#### P0（已完成 ✅）稳定化与对齐

1. ✅ Activity 数据访问统一到 Prisma（写入与读取）
2. ✅ 响应规范统一到 `lib/api/unified-response`
3. ✅ CSRF 体系简化与收敛（仅服务端生成 + 统一 `secureFetch`）
4. ✅ 点赞端点/缺口补齐，评论路由以占位过渡

#### P1（进行中 🔄）统一化与清理

**第一批（已完成 ✅）**

- ✅ RESP-U1: 评论路由统一到 unified-response
- ✅ AUDIT-U1: 评论域审计日志统一为 auditLogger.logEvent
- ✅ MID-Trim: 中间件 matcher 收紧到特定路径
- ✅ AUTH-U1: 创建路由认证工具 route-guard.ts
- ✅ E2E-Interactions: 点赞/收藏交互 E2E 测试
- ✅ OPS-Env: 开发环境健康检查脚本
- ✅ E2E 选择器对齐: 组件添加 data-testid 属性

**第二批（已完成 ✅ - 2025-09-15）**

- ✅ RESP-U2: 活动域响应统一到 unified-response
- ✅ AUTH-U2: 试点使用 route-guard.ts（app/api/user/profile）
- ✅ AUDIT-U2: 活动域审计日志统一（创建/更新/删除）
- ✅ E2E-Guard: 中间件收敛冒烟测试创建

**剩余任务**

1. 🔄 认证与安全单一化（Supabase Session + 轻中间件）
2. 🔄 路由契约/类型统一（Zod DTO → 前后端共享类型）
3. 🔄 中间件瘦身（安全头/来源校验/极少量通用检查）

#### P2（待启动）运维/性能与互动通用化

1. 限流持久化（Upstash/Redis）
2. 评论系统（/api/comments/\*）与互动通用化（likes/bookmarks）
3. 统一审计与指标、灰度与回滚预案

里程碑验收：详见第 8 节。

---

## 2. P0：稳定化与对齐（本周）

### 2.1 Activity 数据访问统一（Prisma Only）

- 目标：一个请求内只用一个数据访问层。Activity 的 GET/POST/PUT/DELETE 全部改为 Prisma；Supabase 仅保留 Auth +
  Storage（图片）。
- 变更清单（按优先级）：
  - `app/api/activities/route.ts`
    - GET：改 Prisma 查询（分页/游标/排序），保留与现在等价字段；`meta.pagination`
      正确输出
    - POST：已改为 Prisma（保留）
  - `app/api/activities/[id]/route.ts`
    - GET/PUT/DELETE：Supabase → Prisma；保留 `isLiked/canEdit/canDelete` 逻辑
  - 点赞路由：`app/api/activities/[id]/like/route.ts`（已补齐，保留）
- 验收：
  - 列表/详情/创建/更新/删除/点赞 全链路 200/201；
  - `pnpm test tests/api/activities-contract.test.ts` 全绿；
  - E2E Feed 基础流不再出现 403/500。

### 2.2 统一响应规范（lib/api-response.ts）

- 目标：移除 `lib/api-guards.ts` 的 `createSuccessResponse/createErrorResponse`
  在业务路由中的使用。
- 变更：
  - 路由返回全部改为 `lib/api-response.ts`；
  - 如果暂不能全量替换，提供轻量适配器，终点形态仍是 `ApiResponse<T>`。
- 验收：
  - 前端 hooks 能正确读取 `meta.pagination`；
  - 契约测试对 `success/data/error/meta.timestamp` 断言通过。

### 2.3 CSRF 收敛

- 目标：仅服务端生成 token；前端统一 `secureFetch` 注入；dev/CI 稳定。
- 任务：
  - `/api/csrf-token`：一次生成，同时写入 JSON 与 `Set-Cookie`（httpOnly）；
  - 前端：统一使用 `secureFetch`（或在 hooks 内封装），所有写请求自动携带
    `X-CSRF-Token` + `credentials: 'same-origin'`；
  - 移除全局 monkey patch `fetch`；
  - 临时保留 dev 兜底（来源校验通过时可放行），P1 再关闭。
- 验收：
  - 本地代理/重载下不再出现随机 403；
  - `pnpm test tests/api/activities-contract.test.ts` 的写操作不再失败。

### 2.4 评论端到端暂缓（占位）

- 目标：Phase 6 不交付评论，避免构建/路由炸裂。
- 任务：
  - `app/api/activities/[id]/comments/route.ts`：GET 空列表 + 标准分页；POST/DELETE 返回 501；
  - UI 保持显隐逻辑，不阻断页面；
- 验收：
  - 页面加载不报错；契约测试不关注评论。

---

## 3. P1：统一化与清理（2 周）

### 3.1 认证与安全单一化

- 目标：
  - 认证统一：Supabase Session（`getCurrentUser`）为唯一事实来源；
  - JWT 仅用于未来跨域/外部 API；
  - 中间件只做安全头/来源校验/少量通用检查，业务权限检查下沉路由。
- 任务：
  - 去除路由对 `withApiSecurity` 中 JWT 强校验的依赖；
  - 中间件 `matcher` 收窄（不要全站命中）；
  - `validateApiPermissions` 的签名与调用统一（只保留 `"auth" | "admin"`）。

### 3.2 契约/类型统一

- 目标：避免「实现与测试/前端」漂移。
- 任务：
  - 用 Zod 定义 DTO（已存在的 schema 复用/扩充），在构建时导出 TS 类型到前端；
  - API 契约（路径/方法/字段）整理成表，CI 通过契约测试才可合并。

### 3.3 中间件瘦身与安全策略统一

- 任务：
  - 删除 dev CSRF 跳过列表（活动/上传/用户），回归统一校验；
  - 安全头、来源校验、限流默认轻量；写请求限流下沉路由（已实现的
    `activity-limits` 可复用）。

---

## 4. P2：运维/性能化与互动通用化（4 周）

### 4.1 限流/会话/日志外置

- 任务：
  - 限流：内存 Map → Upstash/Redis；
  - 错误/安全日志：集中化输出（可先接 filebeat/云日志）。
- 验收：
  - 多实例部署下限流生效；
  - 关键操作（创建/删除/权限拒绝）可追踪。

### 4.2 评论系统（Phase 7）

- 任务：
  - 统一 `/api/comments/*` 多态目标（post/activity），Zod 校验 + Prisma 事务更新
    `commentsCount`；
  - 前端评论组件对齐（输入/分页/嵌套回复/乐观 UI）。

### 4.3 互动通用化（Phase 8）

- 任务：
  - 通用 likes/bookmarks：
    - 方案 A：`/api/likes` + 目标类型/ID；
    - 方案 B：保持资源子路由 `/api/{resource}/{id}/like`；
  - 统一去重约束与动画反馈组件。

---

## 5. 详细迁移清单（初稿）

- 必迁（P0）
  - `app/api/activities/route.ts`（GET→Prisma、POST 已改）
  - `app/api/activities/[id]/route.ts`（GET/PUT/DELETE→Prisma）
  - `app/api/activities/[id]/like/route.ts`（已新增）
  - `app/api/csrf-token/route.ts`（统一 token 源）
  - `hooks/use-activities.ts`、`hooks/use-suggested-users.ts`（统一
    `secureFetch`/CSRF 头）
- 建议迁（P1）
  - `app/api/posts/*`、`app/api/user/*` 若混用 `api-guards` 响应，逐步迁到
    `lib/api-response.ts`；
  - 中间件 `middleware.ts` 收敛 matcher 与逻辑。

---

## 6. 风险矩阵与回滚

- 风险
  - 数据访问迁移引入 N+1 或分页/排序不一致；
  - CSRF 统一后旧路径脚本未适配；
  - 中间件收敛导致漏拦截。
- 预案
  - 每步迁移均保留旧实现分支（`git stash`/注释保留对照），灰度路由开关（`?source=prisma`
    实验性或环境开关）；
  - 回滚只需切回旧路由实现（保留接口路径不变）。

---

## 7. 工具与自动化

- 命令
  - `pnpm quality:check`（lint/format/types/关键测试）
  - `pnpm test` / `pnpm test:e2e`
- CI Gate（新增）
  - 契约测试必须通过：
    - `tests/api/activities-contract.test.ts`
  - 覆盖率门槛维持仓库既有设置（Vitest config）。

---

## 8. 时间与验收

- P0（本周）：
  - 目标：Activity
    GET/PUT/DELETE 全 Prisma；响应规范统一；CSRF 稳定；点赞/上传/关注流打通。
  - 验收：E2E Feed 正常；403/500 消失；契约测试通过。
- P1（两周）：
  - 目标：认证与安全单一化、契约与类型统一、中间件瘦身。
  - 验收：路由只用
    `lib/api-response.ts`；中间件匹配面缩小；dev 关闭 CSRF 路径豁免后仍稳定。
- P2（四周）：
  - 目标：限流/日志外置；评论系统与互动通用化。
  - 验收：多实例/并发下稳定；评论与点赞/收藏契约测试新增且通过。

---

## 9. 角色分工（建议）

- 后端/数据：负责 Prisma 迁移、契约与类型统一、CSRF 收敛、中间件瘦身。
- 前端：`secureFetch` 落地、hooks 统一、组件对齐、E2E 维护。
- QA：契约/E2E/性能基线分离与编排。
- DevOps：日志/限流外置 PoC 与部署脚本。

---

## 10. 结论

最小代价修复的关键是“统一”：统一数据访问、统一响应契约、统一认证/安全入口。P0 先稳住主链路；P1/P2 渐进清理与可运维化。按本方案执行，可在不打断现有功能的情况下，将架构复杂度与维护成本显著降低。
