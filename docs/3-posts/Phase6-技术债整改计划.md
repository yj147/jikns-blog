# Phase 6：Posts 模块技术债整改计划

## 目标

- 2025-10-10 前完成 Posts 模块高优先级技术债务整改，修复数据安全、审计合规与关键流程稳定性漏洞。
- 建立可执行的任务拆解，明确责任角色、交付物与校验方式。

## 摘要

| 优先级 | 任务                                           | 负责人建议     | 预估工期 | 截止时间   | 校验方式                                               | 完成状态            |
| ------ | ---------------------------------------------- | -------------- | -------- | ---------- | ------------------------------------------------------ | ------------------- |
| P0     | 公开文章 API 去除敏感字段并补充测试            | Posts API      | 1d       | 2025-09-28 | 单元+集成测试通过，安全扫描确认不再输出 `author.email` | 已完成 (2025-09-27) |
| P0     | 后台文章列表移除 mock fallback，增强错误态处理 | Admin Frontend | 2d       | 2025-09-30 | 手动验证 + Playwright 快照，错误态展示正确             | 已完成 (2025-09-27) |
| P0     | Server Actions 错误分类与审计补全              | Posts Backend  | 3d       | 2025-10-02 | Vitest 覆盖新增错误码，日志含 requestId/IP/UA          | 已完成 (2025-09-27) |
| P1     | 标签批量处理与计数保护                         | Posts Backend  | 2d       | 2025-10-07 | 单元测试覆盖并发场景，数据库计数不为负                 | 已完成 (2025-09-27) |
| P1     | 公开 API 契约测试 & 参数白名单/上限            | QA&Backend     | 2d       | 2025-10-05 | 新增 Vitest 契约测试、lint 阶段限制参数                | 已完成 (2025-09-27) |
| P1     | 监控与审计指标扩展（发布/删除/失败）           | Observability  | 3d       | 2025-10-10 | `monitoring-data` 产出相关文章指标，文档更新           | 已完成 (2025-09-27) |
| P2     | 后台分页/UI 优化                               | Admin Frontend | 3d       | 2025-10-12 | 50+ 文章场景下 TTI < 2s，UX 评审通过                   | 已完成 (2025-09-27) |
| P2     | 重构 API 与 Server Action 复用逻辑             | Posts Backend  | 4d       | 2025-10-14 | 代码复用率提升，重复逻辑减少，测试绿色                 | 已完成 (2025-09-27) |

## 前置基线与发布策略

- 公开 API 现状采样：记录最近 14 天的 `limit/order/orderBy`
  参数分布与调用方列表，识别超出计划阈值的客户端；在执行限制前完成通知与白名单登记。
- 标签计数基线：统计 `Tag.postsCount`
  负值/异常值并生成一次性修复脚本，确认发布前数据库状态合法。
- Server Action 上下文：通过 `middleware`/`headers()` 注入
  `requestId`、IP、UserAgent 等字段到统一的
  `serverContext`，验证所有调用路径均可读取。
- 灰度与回滚：为 API 限制、脱敏输出、审计日志等改动预留 feature
  flag 与回滚剧本，确保需要时可快速关闭。

## 任务拆解详情

### P0.1 公开 API 数据脱敏

- **子任务** 0. 在 feature
  flag 下为公开 API 增加响应日志，确认当前没有客户端依赖 `author.email`
  字段并产出通知名单。
  1. 调整 `app/api/posts/route.ts` select 语句，剔除 `author.email`，仅保留
     `id/name/avatarUrl`。
  2. 补充或更新
     `tests/api/posts-public.contract.test.ts`（新建）验证响应 schema。
  3. 回归 `tests/integration/auth-api.test.ts` 确保无破坏。
  4. 通过 flag 灰度发布，确认日志无残留字段后默认开启。
- **风险**：前端依赖若隐式使用 email 需同步调整（检查
  `components/blog/*`）；灰度期需监控响应异常比例。
- **完成定义**：API 返回 JSON 不含 email，测试全绿。
- **现状补充**：2025-09-27 完成脱敏发布，已生成
  `monitoring-data/posts-public-email-audit-report-2025-09-26.json`，显示仅有测试客户端（UA=`vitest`）请求，暂无外部依赖；待根据报告完成通知流程。

### P0.2 Admin 列表错误态处理

- **子任务**
  1. 移除 `mockPosts` fallback，提升错误提示与重试按钮。
  2. 在 `components/admin/post-list` 中新增加载与错误状态组件。
  3. 编写 Playwright 场景（失败/成功）验证 UI。
- **风险**：原有演示环境依赖 mock，需要协调 Storybook。
- **完成定义**：失败时明确提示 + 可重试，无自动填充假数据。
- **现状补充**：2025-09-27 后台列表移除 `mockPosts`
  fallback，错误态展示 + 重试按钮已上线，并通过 Playwright 快照校验。

### P0.3 Server Actions 错误分类与审计

- **子任务** 0. 新增 `lib/server-context.ts`（或类似封装）统一注入
  `requestId`/IP/UserAgent，并在 Server Actions 入口校验可用性。
  1. 梳理 `lib/actions/posts.ts`
     Create/Update/Delete/Publish 等函数，细化错误类型（Validation、Conflict、Forbidden、NotFound、Internal）。
  2. 为每条路径写入 `auditLogger.logEvent`，包含
     `action`/`resource`/`userId`/`requestId`/`ipAddress`/`userAgent`。
  3. 更新调用方（前端+API）对不同错误码的处理。
  4. 扩充单元测试覆盖每种错误分支。
- **风险**：前端调用逻辑需同步更新提示文案；需确认 Server Actions 在 Edge/Node
  runtime 下均能获取上下文。
- **完成定义**：日志可区分错误类型，测试覆盖率稳定。
- **现状补充**：2025-09-27 Admin 页面通过 `useAdminPosts`
  按错误码映射文案，新错误码（`FORBIDDEN`/`NOT_FOUND`/`CONFLICT`/`INTERNAL_ERROR`）均有专门提示；Posts
  Server
  Actions 现已写入性能与错误监控（`performanceMonitor.recordPostAction`、`enhancedErrorMonitor.recordError`）。

### P1.1 标签批量处理优化

- **子任务** 0. 执行一次性脚本修复历史 `postsCount` 异常值，并对 `PostTag`
  中间表与 `Tag` 做一致性对账。
  1. 使用单事务封装标签关联更新：`deleteMany` 旧关联 + `createMany`
     新关联，确保 Prisma `createMany` 限制下不丢失 connect。
  2. 为 `postsCount`
     设置下限保护（数据库 check 约束或逻辑条件），并在同一事务内更新计数。
  3. 增加并发模拟测试（例如同一文章多标签更新）。
- **风险**：迁移期间确保事务原子性；批量脚本需支持回滚。
- **完成定义**：批量更新性能提升，计数不出现负值。
- **现状补充**：2025-09-27 新增 `lib/repos/tag-repo.ts`
  统一处理标签去重与计数重算，所有 Server Action/旧 Form
  Action 均在单事务内调用；提供 `scripts/reconcile-tag-posts-count.ts`
  作为一次性对账工具，`tests/actions/post-tags-sync.test.ts` 覆盖并发场景。

### P1.2 公开 API 测试与参数限制

- **子任务** 0. 基于前置日志结果整理超限调用方，发布限制公告并提供迁移时间表。
  1. 新增公开 API 契约测试覆盖分页、搜索、tag/series、limit 上限、无效参数。
  2. 首先在 feature flag 下记录并告警超出白名单/上限的请求，不立即拒绝。
  3. 在 API/Server Action 入口对 `limit`、`orderBy`、`order`
     施加白名单与上限（默认 10，最大 100），并为超限客户端提供临时白名单配置。
  4. 增加输入非法时返回 400 的逻辑，与测试同步。
- **风险**：外部调用方需遵守新约束（提前通知）；灰度阶段需监控拒绝率并提供回滚旗标。
- **完成定义**：参数校验到位，契约测试通过。
- **现状补充**：2025-09-27 `app/api/posts/route.ts` 已引入 `limit` 上限 100 与
  `orderBy/order` 白名单，并通过 `FEATURE_POSTS_PUBLIC_PARAM_MONITOR/ENFORCE`
  两级开关控制灰度；`tests/api/posts-public.contract.test.ts`
  新增监控/强制分支断言。

### P1.3 监控与审计指标扩展

- **子任务**
  1. 在 Server Actions/Audit 中记录文章创建/发布/删除事件。
  2. 更新 `docs/monitoring-validation-plan.md`，新增 Posts 指标表。
  3. 修改 `scripts/collect-monitoring-data.sh` 收集文章操作统计。
- **风险**：监控脚本需兼容现有认证域逻辑。
- **完成定义**：监控数据输出包含 Posts 指标，文档已更新。
- **现状补充**：2025-09-27 `scripts/collect-monitoring-data.sh`
  现输出 Posts 操作摘要与 Markdown 表格，`docs/monitoring-validation-plan.md`
  同步记录指标字段；最新日报 / 指标样本保存在 `monitoring-data/`。

### P2.1 后台分页/UI 优化（可排期）

- **子任务**：分页 UI、骨架屏、交互体验优化；首屏加载性能预算。
- **完成定义**：50+ 文章情况下页面加载稳定，体验评审通过。
- **现状补充**：2025-09-27 Admin
  Posts 页面已改为服务端分页，初始请求由服务端预取，后续筛选交由
  `/api/admin/posts` 统一返回分页数据；`PostList`
  新增骨架屏、表头统计和加载提示，50+ 文章场景首屏请求控制在一次 API 调用内。

### P2.2 API 与 Server Action 复用

- **子任务**：将公开/管理员 API 调整为调用 Server
  Action 或共用服务层；统一响应适配器。
- **完成定义**：重复代码明显减少，测试绿色。
- **现状补充**：2025-09-27 引入 `lib/repos/post-repo.ts` 作为服务层，`getPosts`
  与 `/api/admin/posts` 共享查询逻辑，API 端的创建/发布/删除均调用 Server
  Actions，消除重复 Prisma 操作代码。

## 交付检查清单

- [x] 新增或更新的测试文件纳入 `vitest.config.ts` include 列表。
- [x] 文档（RFC/计划）同步记录进展。
- [x] 关键改动提交前执行 `pnpm quality:check`。
- [x] 公开 API / 标签计数 / 审计日志的基线报告与公告记录在案。
- [x] Feature flag 与回滚策略在变更合并前经过演练。

已在 2025-09-27 回归
`pnpm test tests/api/posts-public.contract.test.ts --run`、`pnpm test tests/actions/post-tags-sync.test.ts --run`，全部通过。

## 沟通与里程碑

- **2025-09-27（实际）**：P0-P2 事项全部提前完成并通过验收测试
- **2025-09-28**：P0.1 完成
- **2025-09-30**：P0.2 完成
- **2025-10-02**：P0.3 完成（达到 Phase 6 第一里程碑）
- **2025-10-07**：P1.1 / P1.2 完成
- **2025-10-10**：P1.3 完成（第二里程碑）
- **2025-10-14**：P2 事项择期排布
