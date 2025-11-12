# 2-auth 模块改进计划（2025-09-27 ~ 2025-10-04）

## 目标

- 统一所有认证相关 API 的鉴权与日志流程
- 强化请求追踪与监控自动化，确保审计闭环
- 消除残余测试/文档不一致问题

## 优先级与任务列表

### P0：必须在 9 月底前完成

1. **统一用户域 API 的认证栈（3 天）**
   - 覆盖范围：`app/api/user/**`、`app/api/users/**` 等仍使用 `withApiAuth`
     的路由。
   - 动作：
     - 替换为 `assertPolicy` + `generateRequestId`
     - 补齐日志字段（requestId/ip/ua/role/status）
     - 更新配套测试（如 `tests/api/user-route-migration.test.ts`）改用
       `mockAssertPolicy`。

2. **强化 Request ID 安全性（1 天）**
   - 将 `generateRequestId` 改为 `crypto.randomUUID()`，避免 `Math.random`
     碰撞。
   - 回归所有使用 requestId 的用例并更新快照。

3. **启用监控定时采集（1 天）**
   - 执行 `bash scripts/install-monitoring-cron.sh`，验证
     `monitoring-data/cron.log` 每小时存在新记录。
   - 在 `docs/monitoring-validation-plan.md` 标记首日 cron 生效，并附样例日志。

### P1：与开发并行进行

4. **清理评论测试遗留 Mock（1 天）**
   - 移除 `mockGetCurrentUser` 依赖，仅保留 `mockAssertPolicy` / `AuthError`
     模拟。
   - 确保 23 条评论契约测试全部通过。

5. **扩展 Phase 2 迁移看板与指标**
   - 更新
     `docs/2-auth/RFC-error-framework-migration.md`：列出剩余路由责任人、截止日期、风险等级。
   - 新增“认证日志质量指标”章节，记录成功/失败样本及四字段覆盖率。

### P2：持续观察与优化

6. **监控噪音与阈值验证（观察 48h）**
   - 关注评论匿名 400 与 DELETE 429 告警，若超出阈值则提出调整建议。
   - 在每日 `daily-summary-YYYYMMDD.md` 中记录误报/漏报情况。

## 依赖关系

- 任务 1、2 完成后再执行任务 4，确保测试与实现一致。
- 任务 3 应尽早执行，为任务 6 提供连续数据。

## 验收标准

- 所有 `app/api/user*/**` 路由输出结构化日志并使用统一错误码。
- `generateRequestId` 不再依赖 `Math.random`，相关测试通过。
- `monitoring-data/cron.log` 按小时滚动，文档中表格标记 ≥1 日的 cron 状态为 ✅。
- 评论契约测试无遗留 mock，新增认证/限流断言全部通过。
- Phase 2 看板反映最新进度与指标，剩余风险仅为阈值观察项。

## 跟踪与交付

- 每日站会同步任务 1 / 2 / 3 进度。
- 在 `docs/monitoring-validation-plan.md` 的 cron 表与 `daily-summary`
  模板中保持记录。
- 计划结束前输出阶段总结，确认剩余风险与下一阶段目标。
