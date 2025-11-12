# Phase 7：Comment 模块技术债整改计划（2025-09-27）

## 1. 计划目的

基于《Phase
7：Comment 模块技术债审计报告（2025-09-27）》的结论，拆解可执行整改任务，确保已上线的评论模块在 Phase
7 技术债清理周期内恢复稳定分页、可靠限流，并精简前端数据流。计划遵循“Never break
userspace”原则：所有改动必须保持向后兼容，保证生产行为不被破坏。

## 2. 任务总览

| 编号 | 优先级 | 任务主题                       | 负责人建议               | 目标完成日 | 验收方式                               |
| ---- | ------ | ------------------------------ | ------------------------ | ---------- | -------------------------------------- |
| T1   | P0     | 评论游标排序与顶层过滤修复     | Backend                  | 2025-09-30 | Vitest 契约 + 端到端翻页验证通过       |
| T2   | P1     | 评论限流接入 Redis/Upstash     | Backend + Platform Infra | 2025-10-02 | 限流单测 + 集成测试 + 监控脚本产出指标 |
| T3   | P2     | 评论前端增量加载与回复展开优化 | Frontend                 | 2025-10-07 | 手测/Playwright 场景、性能对比记录     |
| T4   | P2     | 文档与测试指引同步更新         | QA / Docs                | 2025-10-07 | 文档审阅 + 指令演练通过                |

> 若任务需要跨角色协作，可在每个子任务中补充 Pairing 计划；如遇阻塞，需在每日站会同步并调整里程碑。

## 3. 任务分解与执行细节

### T1：评论游标排序与顶层过滤修复（P0）

**目标**：消除 `listComments`
在高并发下的分页重复/漏项问题，确保默认只返回顶层评论。

**子任务**

1. **排序修复**：
   - 文件：`lib/interactions/comments.ts`
   - 调整 Prisma 查询 `orderBy` 为
     `[{ createdAt: "desc" }, { id: "desc" }]`；确保 `cursor` 与排序字段一致。
2. **顶层过滤**：
   - 默认查询增加 `parentId: null` 条件。
   - `includeReplies`
     分支保持现有二次查询，但避免重复数据（改为在顶层列表后挂载）。
3. **契约测试**：
   - 在 `tests/unit/comments-*.test.ts`（或新增文件）补充相同时间戳分页用例。
   - Playwright：扩展 `tests/e2e/activity-feed.spec.ts`
     或新增评论分页用例，模拟多条同秒评论，验证无重复。
4. **回归验证**：执行 `pnpm test --run tests/unit/comments-*.test.ts`
   与相关 e2e。

**交付标准**

- Vitest 新增用例覆盖同一 `createdAt` 的翻页流程。
- Playwright 断言 `nextCursor` 翻页无重复。
- 无 Breaking change；现有 API 契约保持一致。

**风险与缓解**

- **风险**：老客户端可能依赖当前“混入回复”的行为。
- **缓解**：在发布前通知前端团队，确认所有消费方已准备好处理“顶层 + 按需回复”的结果；若必要，可通过 Feature
  Flag 渐进发布。

### T2：评论限流接入 Redis/Upstash（P1）

**目标**：将评论限流从进程内 Map 升级为集中式存储，确保多实例部署时限流有效。

**子任务**

1. **基础设施接入**：
   - 复用
     `lib/rate-limit/redis-client.ts`（Activity 模块已存在 Upstash 客户端）。
   - 在 `checkCommentRate` 中优先使用 Redis，失败时回退内存。
2. **配置与文档**：
   - `.env.example` 添加 `UPSTASH_REDIS_REST_URL/TOKEN` 使用说明。
   - 更新 Stage D / 工作流文档的限流章节。
3. **监控指标**：
   - 在 `collect-monitoring-data.sh`
     中新增“Comment 限流指标”块，与 Activity 模块格式保持一致。
4. **测试**：
   - 单测：增强
     `tests/unit/comment-limits.test.ts`，分别覆盖 Redis 可用/不可用场景。
   - 集成：恢复 `tests/integration/comments-rate-limit.test.ts` 中 `withApiAuth`
     mock，并新增 Redis 命中断言（可 Mock Redis 客户端）。

**交付标准**

- 限流单测覆盖率保持 ≥ 原基线。
- 集成测试在 CI 通过，含 429 返回结构断言。
- 监控脚本实际输出评论限流统计。

**风险与缓解**

- **风险**：Redis 配置缺失时阻塞发布。
- **缓解**：默认仍支持内存后备，文档明确“生产需配置 Redis”；上线前在 staging 验证连接。

### T3：评论前端增量加载优化（P2）

**目标**：避免一次性获取所有评论，降低首屏延迟；支持按需展开回复。

**子任务**

1. **数据层改造**：
   - `components/comments/comment-list.tsx` 采用 `useSWRInfinite`
     或现有分页 Hook，按 `nextCursor` 拉取顶层评论。
   - 展开回复时，调用
     `/api/comments?parentId=...&includeReplies=true`（或新增专用接口）获取对应子评论。
2. **UI/UX 调整**：
   - Comment card 支持“加载更多”按钮。
   - 回复展开状态本地管理，避免全量二次渲染。
3. **性能记录**：
   - 在 PR 描述或文档中记录前后 Lighthouse/手测对比（首屏时间、请求量）。
4. **自动化测试**：
   - Playwright 新增场景：多页评论加载、展开回复、删除后的刷新。

**交付标准**

- 手测或 Lighthouse 报告显示首屏加载时间下降。
- Playwright 场景通过；前端校验无回归。

**风险与缓解**

- **风险**：老页面依赖一次性数据。
- **缓解**：与产品确认交互期望；必要时为旧页面保留 fallback（Feature Flag）。

### T4：文档与测试指引同步（P2）

**目标**：让文档、脚本与代码一致，确保 QA 能复现所有测试。

**子任务**

1. **文档校正**：
   - 更新 `docs/5-Comment/Stage-*.md`，替换 `withApiAuth` → `assertPolicy`
     等新实现细节。
   - 调整测试命令，移除不存在的
     `comments-contract.test.ts`，改写为实际可运行的脚本。
2. **脚本验证**：
   - 按文档执行一次完整指令（至少
     `pnpm test tests/api/comments-route.test.ts`、`pnpm test tests/integration/comments-rate-limit.test.ts`）。
   - 将验证截图或日志附在 PR 描述。

**交付标准**

- 文档审阅通过（双人 Review）。
- QA 在 staging 环境按文档完成一次“端到端检查”，无阻塞。

**风险与缓解**

- **风险**：文档更新滞后导致沟通成本上升。
- **缓解**：采用 Docs PR + QA 审阅流程，合并前必须确认执行记录。

## 4. 依赖与资源

- **工具**：Vitest、Playwright、Upstash Redis、监控采集脚本。
- **人员**：
  - Backend：负责 Prisma/限流逻辑及测试。
  - Platform Infra：协助 Redis 权限与部署。
  - Frontend：负责 UI、状态管理与 E2E 覆盖。
  - QA/Docs：同步指引，执行回归。
- **资源需求**：
  - Upstash/Redis 凭证（生产 + Staging）。
  - Playwright 测试环境（需保证 `pnpm dev` 可用）。

## 5. 质量门禁

- 所有任务合入前必须通过 `pnpm quality:check`。
- 新增/变更逻辑需有对应 Vitest/Playwright 覆盖；关键路径加入监控校验。
- 文档变更要求 Review + 实际演练记录。

## 6. 风险管理

| 风险                             | 等级 | 预防/应对措施                                       |
| -------------------------------- | ---- | --------------------------------------------------- |
| Redis 接入延迟导致限流上线受阻   | 中   | 先合入代码并默认回退内存；配置准备好后再开启。      |
| 前端增量加载引起历史页面行为变化 | 中   | 通过 Feature Flag 渐进启用；先在内部页面/灰度验证。 |
| 文档不同步造成 QA 误操作         | 中   | 采用“文档 PR + QA 演练”双重审核。                   |

## 7. 交付与汇报

- 每周例会同步进度，重点汇报 P0/P1 任务状态。
- 完成后输出《整改完成报告》，更新到 `docs/5-Comment/` 并链接至整体 Phase
  7 汇总。
- 监控指标需在整改完成后一周内提供稳定数据截图。

---

**编制人**：Linus 模式技术助手  
**日期**：2025-09-27
