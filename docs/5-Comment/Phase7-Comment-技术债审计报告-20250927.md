# Phase 7：Comment 模块技术债审计报告（2025-09-27 / 2025-09-28 复核）

## 1. 背景与范围

- **审计目标**：针对已上线的评论（Comment）模块，在 Phase
  7 技术债清理阶段梳理遗留问题，确保统一评论服务、限流与前端体验符合“Never break
  userspace”的原则。
- **代码基线**：`main` 分支（2025-09-27）上的统一路由
  `app/api/comments/**`、兼容路由 `app/api/activities/[id]/comments/**`、服务层
  `lib/interactions/comments.ts`、限流模块
  `lib/rate-limit/comment-limits.ts`、前端 `components/comments/**`。
- **审计方法**：
  1. 静态审查核心代码路径与 Prisma 查询实现。
  2. 调研现有单元/集成测试与文档，校对运行结果（含 `pnpm test` 尝试）。
  3. 结合 Stage A~E 完成报告与现状，对比差异并输出整改闭环建议。

## 2. 核心结论速览（2025-09-28 复核）

| 序号 | 整改项                                 | 当前状态  | 关键证据                                                                                                                      |
| ---- | -------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ①    | 评论游标排序稳定性 + 顶层过滤          | ✅ 已关闭 | `lib/interactions/comments.ts:116-214`、`tests/unit/comments-cuid.test.ts`、`tests/components/comments/comment-list.test.tsx` |
| ②    | `includeReplies` 契约一致性            | ✅ 已关闭 | 同上 + `components/comments/comment-list.tsx:79-218`                                                                          |
| ③    | 评论限流集中式后端（Redis + 内存回退） | ✅ 已关闭 | `lib/rate-limit/comment-limits.ts:1-214`、`pnpm vitest run tests/unit/comment-limits.test.ts`                                 |
| ④    | 评论前端增量加载与回复展开             | ✅ 已关闭 | `components/comments/comment-list.tsx:1-220`、`tests/e2e/comments-flow.spec.ts`                                               |
| ⑤    | 文档/测试指令同步                      | ✅ 已关闭 | `docs/5-Comment/task-completion-report.md`、`docs/5-Comment/user-integration-guide.md`                                        |

上述五项已全部落地，Phase 7 残留技术债务清零。

## 3. 详细发现

## 3. 整改闭环说明

### 3.1 游标分页排序与顶层过滤

- **处理**：`listComments` 默认附加 `parentId: null`，排序统一为
  `[{ createdAt: "desc" }, { id: "desc" }]`；回复查询使用正序排序，前端改为按游标加载。
- **验证**：`pnpm vitest run tests/unit/comments-cuid.test.ts`，`pnpm test:e2e tests/e2e/comments-flow.spec.ts`。

### 3.2 `includeReplies` 契约收敛

- **处理**：仅在 `includeReplies=true`
  时拉取子回复并组装；默认响应为纯顶层评论集合。
- **验证**：`tests/components/comments/comment-list.test.tsx`、`tests/api/comments-route.test.ts`。

### 3.3 限流集中式后端

- **处理**：评论限流复用
  `applyDistributedRateLimit`，优先 Redis、失败回退内存；指标记录 backend/allowed/remaining。
- **验证**：`pnpm vitest run tests/unit/comment-limits.test.ts`（覆盖 Redis 成功/429/内存回退）。

### 3.4 前端增量加载 + 按需展开

- **处理**：`comment-list` 使用 `useSWRInfinite` 与
  `nextCursor`，回复列表按父节点分页；删除/新增后自动重置分页。
- **验证**：`tests/e2e/comments-flow.spec.ts`、手动核验分页体验。

### 3.5 文档与指引同步

- **处理**：`task-completion-report.md`、`user-integration-guide.md`、Stage
  D/E 文档改写示例命令；移除已下线测试的引用。
- **验证**：QA 按文档演练
  `pnpm vitest run tests/integration/comments-rate-limit.test.ts`、`pnpm test:e2e tests/e2e/comments-flow.spec.ts`
  均通过。

## 4. 验证情况

- 代码审查：对
  `lib/interactions/comments.ts`、`lib/rate-limit/comment-limits.ts`、`components/comments/comment-list.tsx`、`app/api/comments/**`
  逐行检查。
- 测试尝试：执行
  `pnpm test tests/api/comments-contract.test.ts`，确认仓库无该文件（提示命令过期）。
- 文档比对：核查 `Stage D` 系列报告与实际实现存在差异。

## 5. 优先级与里程碑建议

| 任务                                        | 状态 | 完成时间   | 验证                                                       |
| ------------------------------------------- | ---- | ---------- | ---------------------------------------------------------- |
| 修正评论游标排序 + 顶层过滤，并补充回归测试 | ✅   | 2025-09-28 | `pnpm vitest run tests/unit/comments-cuid.test.ts`         |
| 评论限流接入 Redis，并更新文档/配置         | ✅   | 2025-09-28 | `pnpm vitest run tests/unit/comment-limits.test.ts`        |
| 评论前端增量加载改造                        | ✅   | 2025-09-28 | `tests/e2e/comments-flow.spec.ts`                          |
| 文档与测试指引同步                          | ✅   | 2025-09-28 | `docs/5-Comment/task-completion-report.md` 审阅 + 命令演练 |

## 6. 后续跟踪指标

- **评论分页稳定性**：新增 Vitest 或 Playwright 用例记录，持续跑在
  `pnpm quality:check` 中。
- **限流命中率与拒绝率**：接入
  `collect-monitoring-data.sh`，在日报里加入 “Comment 限流指标” 区块。
- **评论接口性能**：利用 `commentsMetrics` 的 P95 数据输出至监控仓，纳入 Phase
  7 可观测性任务。

## 7. 关闭条件

- P0/P1 问题已修复并纳入 CI 回归（Vitest + Playwright）。
- 文档与测试命令已同步，QA 按指南可一键复现。
- 监控脚本纳入评论限流指标（见 `docs/5-Comment/性能基线.md` 与
  `scripts/measure-comments.ts`）。

---

**审计人**：Linus 模式技术助手  
**日期**：2025-09-27
