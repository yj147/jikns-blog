# Phase 8：Like & Collection 模块技术债整改计划（2025-09-28）

## 1. 计划目的

针对《Phase8-LikeCollection-技术债审计报告-20250928》的结论，拆解可执行整改任务，优先解决 P0/P1 问题并同步文档。所有改动必须保持向后兼容，并通过既有测试基线。

## 2. 任务总览

| 编号 | 优先级 | 任务主题                                | 建议负责人         | 目标完成日 | 验收方式                                                                          |
| ---- | ------ | --------------------------------------- | ------------------ | ---------- | --------------------------------------------------------------------------------- |
| T1   | P0     | 收藏服务层测试同步 + 同秒游标回归       | Backend            | 2025-09-29 | `pnpm vitest run tests/unit/bookmarks-service.test.ts` 通过；新增同秒分页用例覆盖 |
| T2   | P1     | Likes/Bookmarks 限流接入 Redis 并补指标 | Backend + Platform | 2025-10-02 | Redis 优先、内存回退生效；新增单/集成测通过；文档补 env 指引                      |
| T3   | P1     | 点赞用户列表瘦身为用户 DTO              | Backend            | 2025-10-01 | `/api/likes?action=users` 只返回 `{id,name,avatarUrl}`；API/组件测试更新并通过    |
| T4   | P2     | 文档命令与验证指引更新                  | Docs / QA          | 2025-09-30 | Phase8 文档命令改为可执行脚本；新增限流/分页验证步骤                              |

## 3. 任务分解与执行细节

### T1：收藏服务层测试同步（P0）

- **目标**：修复 `getUserBookmarks`
  单测断言错误，并为同一时间戳场景提供稳定回归。
- **子任务**：
  1. 更新 `tests/unit/bookmarks-service.test.ts` 断言，匹配
     `[{ createdAt: "desc" }, { id: "desc" }]` 排序。
  2. 增加“同秒多条收藏”的分页用例，验证 `nextCursor` 稳定。
  3. 重新运行 `pnpm vitest run tests/unit/bookmarks-service.test.ts`，确保绿灯。
- **风险**：若排序策略再次变动需同步两处；修复后立即纳入 CI。

### T2：点赞/收藏限流接入 Redis（P1）

- **目标**：与评论模块保持一致，优先使用 Redis/Upstash，回退内存，并打点监控。
- **子任务**：
  1. 在 `lib/rate-limit/like-limits.ts` 与 `bookmark-limits.ts` 引入
     `getRedisClient`，实现 “Redis 优先 + 失败回退”。
  2. 记录 `MetricType` 指标（参考评论限流），更新
     `scripts/collect-monitoring-data.sh` 收集逻辑。
  3. `.env.example`、Phase8 文档补充 `UPSTASH_REDIS_*` 指南。
  4. 增强单测/集成测：包含 Redis 可用/不可用与 429 响应断言。
- **风险**：Redis 凭证缺失导致部署阻塞；建议 staged rollout，默认仍可回退内存。

### T3：点赞用户列表 DTO 瘦身（P1）

- **目标**：确保 `/api/likes?action=users` 与设计契约一致，避免额外字段泄露。
- **子任务**：
  1. 在 `lib/interactions/likes.ts` 将返回值整理为 `{ id, name, avatarUrl }`。
  2. 更新 `tests/api/likes-route.test.ts` 与相关组件测试，校验新结构。
  3. 若前端有依赖旧字段，协调同步改造，并在变更说明中提醒。
- **风险**：历史调用方可能使用了 extra 字段（authorId/postId），需提前沟通并提供兼容期公告。

### T4：文档命令与验证指引更新（P2）

- **目标**：让 Phase 8 文档指令可一键执行，便于 QA 复核。
- **子任务**：
  1. 更新 `Phase8-工作流任务计划.md`、`P8-BE-1-收藏服务层完成报告.md`
     等文档中的命令为 `pnpm vitest run ...`、`pnpm test:e2e ...`。
  2. 新增 likes/bookmarks 限流/分页验证步骤，说明所需环境变量与预期输出。
  3. 在整改完成后附执行日志或截图，佐证文档有效。
- **风险**：忽略文档同步会再次造成 QA 与研发脱节；建议纳入 merge checklist。

## 4. 依赖与资源

- **依赖**：Upstash/Redis 访问凭证（T2），统一 logger/metrics 模块。
- **人员**：Backend 负责服务层与限流改造；Platform 协助 Redis 配置；Docs/QA 负责文档与验证。

## 5. 质量门禁

- 所有任务合并前必须通过 `pnpm quality:check`。
- 新增/调整逻辑需增加相应 Vitest/Playwright 覆盖。
- T2 完成后在 Staging 验证 Redis 开关，确保 429 命中记录准确。

## 6. 风险与缓解

| 风险                                   | 等级 | 缓解措施                                                  |
| -------------------------------------- | ---- | --------------------------------------------------------- |
| Redis 凭证尚未发放，无法验证集中式限流 | 中   | 先实现代码与回退机制，待凭证到位后在 Staging 启用验证     |
| 点赞用户列表字段调整影响旧依赖         | 中   | 事前公告 + 提供迁移说明；必要时提供 feature flag 逐步切换 |
| 文档更新滞后导致再次审计发现同类问题   | 低   | 设置文档审核人，merge 前确认命令可执行                    |

## 7. 交付与汇报

- 每项任务完成后在同目录添加完成报告或在原文档中附修订记录。
- 关键节点（T1/T2/T3）完成后建议在周会通报，确认无回归风险。
- Rectify 后重新运行审计核对（尤其是限流与响应契约），确保问题闭环。

---

**编制人**：Linus 模式技术助手  
**日期**：2025-09-28
