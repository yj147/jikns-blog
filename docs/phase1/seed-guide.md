# Phase 1 Feed 种子指南

> 目的：用同一批真实数据驱动 `/api/activities`、`/api/comments` 与 Admin 统计，使 Vitest/E2E 不再依赖 demo fixture。

## 入口与命令

1. 确保本地 Supabase/Postgres 正在运行（默认端口 `54322` 或设置 `DATABASE_URL`）。
2. 执行 `pnpm db:seed -- --scenario=feed`。
   - 脚本入口：`prisma/seed.ts`，其中 `--scenario=feed` 会在基础种子之后调用 `scripts/seed/activities.ts`。
   - 命令会**清空全部业务表**，重新写入基线数据，请勿在生产库运行。
3. 默认场景（无参数）仍然只写入最小演示数据；CI、本地联调 Activity/Feed 必须使用 `feed` 场景。

## 数据范围

### 用户账号（邮箱 / 密码）

| 角色 | 凭据 | 说明 |
| --- | --- | --- |
| 管理员 | `admin@example.com / admin123456` | 默认管理员，Admin 控制台、活动汇总作者 |
| 普通用户 | `user@example.com / user123456` | 旧版演示账号，兼任评论、点赞的真实用户 |
| 运维观察员 | `feed-ops@example.com / feedops123` | Role=ADMIN，负责发布窗口、置顶活动 |
| 性能写手 | `feed-writer@example.com / feedwriter123` | 主要内容产出者，含图片+非图片动态 |
| 数据分析师 | `feed-analyst@example.com / feedanalyst123` | 产出指标类动态、评论，绑定 `/api/comments` | 
| 体验访客 | `feed-guest@example.com / feedguest123` | 负责 UX 反馈与活动评论 | 
| 活动订阅者 | `feed-reader@example.com / feedreader123` | 关注 feed-ops/feed-writer，用于 `orderBy=following` 验证 |

### 活动流基线

- 置顶 `act-feed-lcp-cutover`：含图片、`#performance`+`#analytics` 标签，代表官方公告。
- `act-feed-hero-skeleton`：移动端 skeleton + streaming 成果，`hasImages=true`。
- `act-feed-nightly-metrics`：纯文本指标播报，方便 `hasImages=false`、搜索、分页用例。
- `act-feed-mobile-rollback`：移动端降级通知，覆盖 `mobile` 标签与多评论场景。
- `act-feed-ux-feedback`：体验反馈帖，用于 `/api/comments` 与 likesCount 同步验证。
- `act-feed-admin-digest`：管理员发布，确保 Admin 仪表盘与 Feed 共用同源数据。

每条活动都写入：
- 真实创建时间（2025-02-01 ~ 2025-02-04）——便于查询 `dateFrom/dateTo`。
- `likesCount` 与 `commentsCount` 与实际 Like/Comment 行完全一致。
- `ActivityTag` 关联 (`performance`, `release`, `ux`, `analytics`, `mobile`)；Playwright 过滤器直接命中。

### 关注与互动

- `feed-reader@example.com` 关注 `feed-ops/feed-writer/feed-analyst`，`/api/activities?orderBy=following` 可立即返回数据。
- `user@example.com` 额外关注 `feed-ops`，保证旧账号也能测 following。 
- Likes/Comments 总计：`18` 个点赞 / `7` 条评论（含文章与活动），Admin 统计与 `/api/comments` 均使用该批数据。

## 使用建议

1. 播种后立刻运行 `pnpm build && pnpm start`，再执行 `pnpm test:e2e tests/e2e/activity-feed.spec.ts` 验证真实 API。
2. 若需要还原最小演示数据，执行 `pnpm db:seed`（无 `--scenario`）即可。
3. CI 中若需并行场景，可通过 `pnpm db:seed -- --scenario=feed && pnpm test` 保证真数据覆盖。

## 故障排查

| 症状 | 排查步骤 |
| --- | --- |
| 命令提示无法连接数据库 | 确认 `supabase start` 已运行，或在 `.env.local` 中设置 `DATABASE_URL`。 |
| Playwright 仍命中 demo fixture | 确认 `.env.local` 未设置 `ACTIVITY_API_FIXTURE`，并已执行 `pnpm db:seed -- --scenario=feed`。 |
| Following Feed 为空 | 检查 `feed-reader@example.com` 是否成功关注（`follows` 表应包含 3 条记录）。 |
