# Phase 7 - 评论系统 工作流任务计划（全链路）

**版本**: 1.0  
**日期**: 2025-09-11  
**范围**: 评论系统（统一服务 + 统一路由 + 前端集成 + 质量保障）  
**原则**: 零破坏、最小复杂度、渐进式迁移（保留兼容端点）

---

## 0) Definition of Ready（启动条件）

- 文档就绪：
  - 设计基线：`docs/5-Comment/评论系统-技术设计.md`
  - 架构基线：`docs/Architecture-Remediation-Plan-All-Modules.md`
- 代码基线：统一交互层与路由已存在
  - 服务层：`@/lib/interactions/comments.ts`
  - 统一路由：`app/api/comments/(route.ts | [id]/route.ts)`
  - 兼容路由：`app/api/activities/[id]/comments/(route.ts | [commentId]/route.ts)`
- 人员与环境：
  - FE/BE/QA 角色确认；本地 `pnpm dev` 正常；Playwright/Vitest 可运行

---

## 1) 目标与验收（Definition of Done）

- 功能：Post/Activity 下可创建/列表/删除评论；支持单层回复（含顶级+直接子回复返回）
- 安全：写操作需 `ACTIVE` 用户；XSS 清理；错误码统一
- 兼容：Activity 旧端点保持有效（薄封装转调）
- 质量：
  - 单元：服务层核心用例覆盖
  - 集成：统一路由与兼容路由主流路径覆盖
  - E2E：动态评论全链路一条绿
- 文档：用户指南（简）+ 变更记录更新

---

## 2) 阶段划分与任务清单

### Stage A — 服务层硬化（BE）

- A1 校验与清理
  - 校对服务层函数输入约束与返回形态（与设计契约一致）
  - XSS 清理点统一在写入前；保留软删/硬删分支
- A2 计数策略核对
  - Activity：`commentsCount` 冗余增减（仅硬删 -1）
  - Post：聚合 `count`，不维护冗余字段
- A3 单元测试（Vitest）
  - create/list/delete 的正常/异常分支、游标分页与 `includeReplies`
  - 软删/硬删分支；权限校验；目标不存在

验收：`pnpm vitest run tests/integration/comments-service.test.ts tests/integration/comments-rate-limit.test.ts`
通过，覆盖率纳入全仓基线

### Stage B — API 契约验证（BE）

- B1 统一路由测试（集成）
  - `GET/POST /api/comments`，`DELETE /api/comments/[id]`
  - 错误码：401/403/400/404；分页 `nextCursor` 行为
- B2 兼容路由测试（集成）
  - `GET/POST /api/activities/[id]/comments`
  - `DELETE /api/activities/[id]/comments/[commentId]`
- B3 日志/错误对齐
  - `@/lib/utils/logger` operation 与 context 字段完备

验收：关键用例集成测试通过；日志字段抽样验证

### Stage C — 前端集成（FE）

- C1 通用组件抽象（不破坏现有 UI）
  - 新建 `components/comments/(comment-list.tsx | comment-form.tsx)` 最小实现
  - 属性：`{ targetType: 'post' | 'activity'; targetId: string }`
  - 行为：列表+分页、发表/回复、删除（作者/ADMIN 可见）
- C2 接入
  - Activity：现有组件内部改为包装通用组件（路径不变）
  - Posts：在 `app/blog/[slug]/page.tsx` 注入评论区（最小样式适配）
- C3 交互与状态
  - 乐观更新（发表/删除）；错误提示（统一错误码→用户文案）

验收：手测主流交互；UI 回归无破坏；SSR/RSC 行为正常

### Stage D — 安全与限流（BE，可选增强）

- D1 评论速率限制骨架
  - `lib/rate-limit/comment-limits.ts`（每用户 + 每IP）
  - 在 `POST /api/comments` 入口校验（开关可控）
- D2 安全审计
  - 关键写操作审计日志（actor/target）

验收：压测烟囱路径，限制命中与错误码符合预期

### Stage E — 可观测与性能（BE/QA）

- E1 指标与日志
  - API QPS/错误率/P95；慢查询样例记录
- E2 性能基线
  - 游标分页 10/50 条响应时间和资源消耗记录

验收：记录产出并归档 `docs/5-Comment/性能基线.md`（可后补）

### Stage F — 文档与交付（BE/FE/QA）

- F1 更新文档
  - 用户与开发者简要指南（README 片段或 docs 子文档）
  - 变更条目（Changelog/报告）
- F2 发布说明
  - 风险与回退（见下）

验收：文档可复现；团队评审通过

---

## 3) 质量门禁与工具链

- 代码质量：`pnpm quality:check`（ESLint/Prettier/TS）
- 单元与集成：`pnpm test`、`pnpm test:coverage`（保持全仓阈值）
- E2E：`pnpm dev` → `pnpm test:e2e`（验证一条端到端流）
- 代码评审：Conventional Commits + 小 PR（功能/测试/文档分 PR 更佳）

---

## 4) 回滚与灰度

- 回滚策略
  - 统一路由与兼容路由并存；若出现问题，客户端可临时切回兼容端点
  - 统一服务层不移除旧逻辑路径；删除仅在两版后评估
- 灰度开关
  - 可在前端以开关控制是否使用统一路由（默认开启）

---

## 5) 风险与缓解

- 软删/硬删计数不一致 → 仅硬删变更计数；对 Activity 以增量保障
- 大量子回复导致 N+1 → 仅返回单层回复；后续引入批量聚合接口
- 速率限制未上线 → 先以最小频控在网关侧；后端骨架准备就绪
- UI 差异 → Activity 保持原入口，内部换实现；Posts 以最小样式接入

---

## 6) 角色与分工（建议）

- BE：服务层/路由/测试/日志与指标
- FE：通用组件抽象与接入、用户体验
- QA：用例编写、集成/E2E 执行、验收记录

---

## 7) 里程碑与时间预估（工作日）

- A 服务层硬化 + 单测：1.0
- B 路由集成测试：0.5
- C 前端抽象与接入：1.5
- D 安全与限流（可选）：0.5
- E 可观测与基线：0.5
- F 文档与发布：0.5 合计：~4.5d（不含评审与缓冲）

---

## 8) 提交与 PR 检查清单

- [ ] 符合 Conventional Commits（feat/comment: ..., fix(comment): ...）
- [ ] 通过 `pnpm quality:check` 与 `pnpm test`
- [ ] 关键路径集成/E2E 通过，附运行摘要
- [ ] 文档更新（设计/工作流/用户指引/变更记录）
- [ ] 不破坏现有端点/行为（兼容层验证截图或日志）

---

## 9) 成果归档

- 设计：`docs/5-Comment/评论系统-技术设计.md`
- 工作流（本文）：`docs/5-Comment/Phase7-工作流任务计划.md`
- （可选）性能：`docs/5-Comment/性能基线.md`
- 报告：合并到阶段性修复报告（Phase D 完成后）
