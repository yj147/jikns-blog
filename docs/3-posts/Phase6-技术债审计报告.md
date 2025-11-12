# Phase 6：Posts 模块技术债务审计报告

## 执行摘要

- **时间**：2025-09-27（复核）
- **结论**：Phase 6
  P0/P1/P2 技术债项全部收敛，现网接口与后台入口符合脱敏、审计、分页和监控要求。
- **验证**：2025-09-27 运行
  `pnpm test tests/api/posts-public.contract.test.ts --run`、`pnpm test tests/actions/post-tags-sync.test.ts --run`
  全部通过；`monitoring-data/posts-public-email-audit-report-2025-09-26.json`
  显示仅测试客户端访问，未发现外部依赖。

## 审计范围

- 代码：`app/api/posts/route.ts`、`app/api/admin/posts/route.ts`、`lib/actions/posts.ts`、`lib/repos/post-repo.ts`、`lib/repos/tag-repo.ts`、`hooks/use-admin-posts.ts`、`components/admin/post-list.tsx`
  等。
- 测试：`tests/api/posts-public.contract.test.ts`、`tests/actions/post-tags-sync.test.ts`。
- 监控与文档：`monitoring-data/`
  日志样本、`docs/monitoring-validation-plan.md`、`docs/3-posts/Phase6-技术债整改计划.md`。

## 整改结果总览

| 原始风险                        | 当前状态                                                                                                                  | 关键证据                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 公开 API 泄露作者邮箱、参数无界 | `app/api/posts/route.ts` 默认启用 `postsPublicHideAuthorEmail()` 并限制 `limit/order/orderBy`；契约测试覆盖隐藏与违规分支 | `app/api/posts/route.ts`、`tests/api/posts-public.contract.test.ts`                                       |
| 后台列表 fallback 掩盖错误      | `hooks/use-admin-posts.ts`、`components/admin/post-list.tsx` 仅回显真实数据，错误态提供重试按钮与 toast 提示              | `hooks/use-admin-posts.ts`、`components/admin/post-list.tsx`                                              |
| Server Action 错误码与审计缺口  | `lib/actions/posts.ts` 引入 `PostActionException` 分类与 `recordAuditEvent()` 审计；Admin API 回传 requestId/timestamp    | `lib/actions/posts.ts`、`app/api/admin/posts/route.ts`                                                    |
| 标签批量操作串行导致计数错误    | `lib/repos/tag-repo.ts` 在单事务内删除/批量创建并重算计数；并发测试守护计数不为负                                         | `lib/repos/tag-repo.ts`、`tests/actions/post-tags-sync.test.ts`                                           |
| API 与 Server Action 逻辑重复   | `lib/repos/post-repo.ts` 统一分页/统计查询，Server Action 与 `/api/admin/posts` 重用                                      | `lib/repos/post-repo.ts`、`app/api/admin/posts/route.ts`                                                  |
| 监控与审计指标缺失              | `scripts/collect-monitoring-data.sh` 输出 Posts 指标，`auditLogger` 记录所有动作，日报已生成                              | `scripts/collect-monitoring-data.sh`、`lib/actions/posts.ts`、`monitoring-data/daily-summary-20250927.md` |

## 复核详情

### 1. 公开 API 脱敏与参数治理

- `app/api/posts/route.ts` 采用 `postsPublicHideAuthorEmail()`
  默认隐藏邮箱；仅在 feature flag 显式关闭时暴露字段，并通过
  `recordPostsPublicEmailAudit()` 留痕。
- 对 `limit` 设置 1-100 夹逼，对 `orderBy`/`order`
  使用白名单；开启强制模式时直接返回 400。
- `tests/api/posts-public.contract.test.ts`
  验证脱敏、监控模式与强制拒绝路径，确保契约收敛。

### 2. 后台文章列表

- `hooks/use-admin-posts.ts` 去除 `mockPosts` fallback，将请求失败写入 `error`
  并触发 toast，同时保留骨架屏首屏体验。
- `components/admin/post-list.tsx` 增加加载骨架、错误告警与 `onRetry`
  控件，避免掩盖真实故障。
- `lib/repos/post-repo.ts`
  统一分页、统计和标签聚合，服务器端分页数据与 UI 视图一致。

### 3. Server Actions 错误分类与审计

- `lib/actions/posts.ts` 定义
  `ValidationError`、`ForbiddenError`、`NotFoundError`
  等派生异常，`classifyError()` 据此输出精确错误码。
- `recordAuditEvent()` 将 `requestId`、`ipAddress`、`userAgent`、`action`
  等字段统一写入 `auditLogger`，满足审计追踪。
- `/api/admin/posts` 在响应 meta 中回传 `requestId` 与
  `timestamp`，便于链路定位。

### 4. 标签批量处理

- `lib/repos/tag-repo.ts#syncPostTags`
  在同一事务内执行删除、`createMany`、计数重算，杜绝串行查询导致的锁竞争与计数失衡。
- `tests/actions/post-tags-sync.test.ts` 覆盖并发更新场景，确认 `postsCount`
  不出现负值。

### 5. 监控与文档

- `scripts/collect-monitoring-data.sh`
  生成包含 Posts 操作指标的 JSON、Markdown 摘要；最新日报位于
  `monitoring-data/daily-summary-20250927.md`。
- `docs/monitoring-validation-plan.md` 已补录 Posts 指标字段，与本计划同步更新。
- `monitoring-data/posts-public-email-audit-report-2025-09-26.json`
  显示公开 API 未被外部依赖邮箱字段。

## 测试与验证

- 2025-09-27 完成：`pnpm test tests/api/posts-public.contract.test.ts --run`
- 2025-09-27 完成：`pnpm test tests/actions/post-tags-sync.test.ts --run`
- Admin Posts UI 分页/筛选/错误态 2025-09-27 手动验收通过。

## 残留事项

- 暂无未关闭的技术债；建议持续以灰度方式观察
  `FEATURE_POSTS_PUBLIC_PARAM_ENFORCE`，根据监控数据稳步推进强制模式。

## 附录

- 参考日志：`monitoring-data/daily-summary-20250927.md`
- 计划文档：`docs/3-posts/Phase6-技术债整改计划.md`
