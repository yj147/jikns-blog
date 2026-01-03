# Next.js 博客性能优化方案

> 生成日期: 2026-01-01更新日期: 2026-01-03项目: jikns_blog (Vercel 部署)

## 背景

项目在 Vercel 部署后暴露出性能问题：

- 页面渲染慢
- 加载慢
- 跳转慢
- API 请求冗余

## 执行清单（逐项优化 → 复验 → 上线）

> 约定：每个优化项必须先部署到 Preview，完成“性能复验 +
> E2E 回归”，再部署 Production。Preview 复验：登录/OAuth 回调用稳定别名域：`https://jiknsblog-git-perf-phase0-preview-jikns-projects.vercel.app`；性能/Network/Bundle 断言优先用 Vercel
> deployment 的随机域（避免别名命中旧 `_next/static`）。

| 优化项                                                                                   | 实现 | Preview 性能 | Preview 回归 | Production 部署 | Production 回归 |
| ---------------------------------------------------------------------------------------- | ---: | -----------: | -----------: | --------------: | --------------: |
| P0-0.1 禁用高成本 Link prefetch（止血 `_rsc` 预取风暴）                                  |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.2 `/api/user` 去重 + 后端降本（高频且慢）                                           |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.3 CSRF token 按需加载（读页面不请求 `/api/csrf-token`）                             |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.4 `/feed` 首屏可见（ISR + 延后非关键请求）                                          |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.5 博客详情页并行化（降低 TTFB）                                                     |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.6 主要路由骨架屏（提升感知性能）                                                    |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.7 修复 `/favicon.ico` 404                                                           |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.8 `/blog` 首屏冗余 `/api/posts` 去除                                                |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.9 公共页恢复可缓存（`/blog`、`/tags`、`/tags/[slug]`）                              |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.10 Notifications：铃铛首屏仅拉未读数（列表按需、移除轮询）                          |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.11 Comments：评论列表 resetList 去重（避免 SWRInfinite 双请求）                     |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.12 公共页不初始化 Supabase（未登录不加载 `/_next/static/chunks/446-*.js`）          |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.13 首页：开启 ISR（降低 cold TTFB）                                                 |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P0-0.14 Tags 详情：预生成热门标签 params（降低 cold TTFB）                               |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P1-1.1 Posts `unstable_cache`（列表/详情）+ 写后 `revalidateTag`                         |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P1-1.2 Signed URL 稳定化缓存（Storage，减少 token 抖动）                                 |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P2-2.0 `/blog`：移除 Radix Select（原生 `<select>`）                                     |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P2-2.1 Bundle：全站移除 framer-motion（CSS transition 替代）                             |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P2-2.2 `/activities`：移除 react-virtuoso（IntersectionObserver 触底加载）               |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P2-2.3 `/feed`：ActivityCard “更多”菜单按需加载（延后 Radix DropdownMenu）+ 修复复制链接 |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P2-2.4 `/feed`：动态评论列表按需加载（CommentList dynamic import）                       |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P2-2.x Bundle：Radix 低频动态导入 + 拆分巨型组件                                         |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P3-3.0 Markdown 图片：URL 优化（Supabase Render API）+ src 安全白名单                    |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P3-3.1 图片：首屏图片预加载（Blog cover + Markdown 首图）                                |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P3-3.x 图片：扩大 `next/image` 覆盖（头像/动态/文章等）                                  |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.1 Follow 列表：跳过 COUNT(\*)（`includeTotal=false` + 用 public counts）            |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.2 Comments：批量签名作者头像（减少外部签名往返）                                    |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.3 PostRepo：合并 count 查询/减少往返                                                |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.4 Follow 列表：互相关注状态去冗余查询（减少额外 DB 往返）                           |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.5 Activities：GET 轻量鉴权（`getOptionalViewer`）+ 并发签名/点赞状态                |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.6 Comments：reply 请求跳过 totalCount；top-level totalCount 合并为 1 次 count       |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.7 Notifications：列表并行 unread stats + avatar 签名                                |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.8 `/api/search`：unifiedSearch 并行化（Promise.all）                                |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.9 `/api/likes`：Activity 点赞计数读路径去写（读 `activities.likesCount`）           |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |
| P4-4.10 `/api/admin/monitoring`：统计聚合下推数据库（避免全量拉取）                      |   ✅ |           ✅ |           ✅ |              ✅ |              ✅ |

### 当前待办（只看未完成）

**已复验（Preview）**：

- [x] TD-0.1 Link：移除散落的 `prefetch={false}`，统一用
      `components/app-link.tsx` 默认关闭预取（✅：Preview `/`、博客详情无高成本
      `_rsc` 预取放大）
- [x] TD-0.2 AuthProvider：用 `fetchJson("/api/user")`
      复用 inflight 去重与错误处理（✅：Preview 登录后单页 `/api/user` ≤ 1）
- [x] P2-2.1 Bundle：全站移除 framer-motion（CSS
      transition 替代）（✅：`package.json` / `pnpm-lock.yaml` 无
      `framer-motion` 引用；页面回归无报错）
- [x] P3-3.1 图片：首屏图片预加载（Blog cover + Markdown 首图）（✅：Blog cover
      `img[fetchpriority="high"]`；Markdown 首图 `loading="eager"` +
      `fetchpriority="high"`）
- [x] P0-0.2 `/api/user` 去重 + 后端降本（✅：Preview 头部 `x-perf-*`
      对账，Network 无重复调用）
- [x] P0-0.10 Notifications：铃铛首屏仅拉未读数（✅：首屏仅
      `/api/notifications/unread-count`，打开 dropdown 才拉列表）
- [x] P4-4.2 Comments：批量签名作者头像（✅：接口路径覆盖 + 功能回归通过）
- [x] P4-4.4
      Follow 列表：互相关注状态去冗余查询（✅：关注/取消关注回归，列表仅 1 次 follow-list 请求）
- [x] P4-4.3 PostRepo：合并 count 查询/减少往返（✅：Preview `/admin/blog`
      正常渲染，tab 统计/筛选可用）
- [x] P4-4.5 Activities：GET 轻量鉴权（`getOptionalViewer`）+ 并发签名/点赞状态
- [x] P4-4.6 Comments：reply 请求跳过 totalCount；top-level
      totalCount 合并为 1 次 count
- [x] P4-4.7 Notifications：列表并行 unread stats + avatar 签名
- [x] P0-0.11
      Comments：评论列表 resetList 去重（✅ 口径：评论 create/delete 后仅 1 次 GET
      `/api/comments?targetId=...`）

**进行中（本轮）**：

- [x] P4-4.8 `/api/search`：unifiedSearch 并行化（Promise.all）（✅ Preview + ✅
      Production）
- [x] P4-4.9 `/api/likes`：Activity 点赞计数读路径去写（✅ Preview + ✅
      Production）
- [x] P4-4.10 `/api/admin/monitoring`：统计聚合下推数据库（✅ Preview + ✅
      Production）
- [x] TD-0.3 Preview OAuth：callback
      base 归一化到稳定域（避免跨域 PKCE 错误，便于逐分支 Preview 复验）
- [x] P0-0.12 公共页不初始化 Supabase（✅：未登录访问公开页不再强制初始化 Supabase，减少 Supabase 相关 chunk 加载）
- [x] P0-0.13 首页：开启 ISR（✅：`app/page.tsx`
      `export const revalidate = 120`；Preview trace：LCP `600ms` / TTFB
      `196ms`）
- [x] P0-0.14 Tags 详情：预生成热门标签 params（✅：`app/tags/[slug]/page.tsx`
      `generateStaticParams()` 预生成 Top 20；Preview trace：LCP `469ms` / TTFB
      `195ms`）

**已实现**：

- [x] P3-3.x 图片：扩大 `next/image`
      覆盖（头像/动态/文章等）（✅：app/components/lib/hooks runtime 无
      `<img>`，仅 MarkdownRenderer 作为兜底）
- [x] P2-2.x Bundle：Radix 低频动态导入 + 拆分巨型组件

**已上线（Production）**：

- [x] 所有 `P0-*`：Production 部署 + Production 回归（按
      `docs/e2e-production-test-plan.md`）

## 对照数据（Chrome DevTools MCP / /admin/monitoring / Vercel）

> 说明：以下为实验室数据（未限速 / 未 CPU
> throttling），用于定位与对比优化前后变化；最终优先级以 Vercel Speed
> Insights（真实用户）+ Analytics（流量入口）为准。

### Core Web Vitals（lab，No throttling，Production，2026-01-02）

> 复测口径：`ignoreCache=true` + 仅用于定位瓶颈（最终以 RUM 为准）。

- `/`：LCP `540ms`（TTFB `389ms`，CLS `0.00`）
- `/feed`：LCP `755ms`（TTFB `463ms`，CLS `0.06`）
- `/blog`：LCP `736ms`（TTFB `464ms`，CLS `0.00`）
- `/blog/[slug]`（`/blog/e2e-perf-preview-20251231`）：LCP `552ms`（TTFB
  `431ms`，CLS `0.00`）
- `/tags/[slug]`（`/tags/e2e`）：LCP `557ms`（TTFB `449ms`，CLS `0.00`）
- `/activities`：LCP `468ms`（TTFB `282ms`，CLS `0.09`）

### Core Web Vitals（lab，No throttling，Preview，2026-01-02）

> 复测口径：`ignoreCache=true` + No
> throttling（用于对比改动前后差异，不代表真实用户分布）。

- `/feed`：LCP `866ms`（TTFB `193ms`，render delay `673ms`，LCP 为文本节点）
- `/blog`：LCP `487ms`（TTFB `192ms`，render delay `296ms`）
- `/tags`：LCP `796ms`（TTFB `192ms`，render delay `604ms`）
- `/blog/[slug]`：LCP `956ms`（TTFB `572ms`，render delay `384ms`）

### Network（线上观测，Production，2026-01-02）

- 未再观察到“页面加载即触发的大量 `?_rsc=...`
  预取风暴”（首屏 fetch/xhr 维持在必要最小集）
- `/api/user`：关键路由单次导航内 ≤
  1 次（`/`、`/blog`、`/tags/[slug]`、`/feed`、`/activities`），不再出现 3-4 次同页放大
- `/api/csrf-token`：读页面不再触发；仅写请求按需 ensure（以线上 Network/监控复验为准）
- 登录态首屏仅请求
  `/api/notifications/unread-count`；通知列表按需加载；推荐用户可延迟到 idle/交互触发
- 未登录访问受保护 API 时，不应出现 307 → `/login`
  的重定向链（会导致 fetch 解析失败 + SWR 重试，放大请求量）
- Supabase
  Storage 签名头像：源图 640×640，显示 32×32，且 token 变化导致缓存命中率极差（ImageDelivery 估算可节省 ~85kB/次）

### 项目内监控（/admin/monitoring）

> 数据源：`/api/admin/monitoring`（聚合
> `performanceMonitor.getPerformanceReport(24)`）+
> `/api/admin/metrics`（timeseries）。

- 过去 24 小时（2026-01-02 12:05 左右快照）：总请求数 `3504`，平均响应时间
  `2250ms`，慢请求率 `63.58%`（>1s），错误率 `0.00%`
- 认证会话检查（`AUTH_SESSION_CHECK_TIME`）：平均 `403ms`，P95
  `846ms`；权限验证（`PERMISSION_CHECK_TIME`）：平均 `410ms`，P95 `849ms`
- Top slow endpoints（按平均耗时）：`/api/admin/stats`（`3`
  次，`6088ms`）、`/api/auth/register`（`6`
  次，`5819ms`）、`/api/users/:id/followers`（`4`
  次，`4734ms`）、`/api/comments/:id`（`~4.3s`）等

**Preview 快照（2026-01-02）**（样本包含大量测试流量，主要用于“趋势与对账”）：

- 注意：当前 Preview 与 Production 共用同一套 `performanceMetric`
  存储（report 会混合两边流量），需要用 `VERCEL_ENV`
  维度做切分后才适合做“优化前后对比”。

### Vercel Web Analytics（真实流量，Last 7 Days）

> 时间范围：`Dec 26 '25, 12pm - Jan 2 '26, 12:59pm`，环境：Production

- Visitors：`19`
- Page Views：`575`
- Bounce Rate：`32%`
- Pages（按 visitors）：`/`(17)、`/feed`(11)、`/blog`(7)（其余多为管理后台/测试流量）

> 注：过去 7 天流量很小，且包含大量管理后台/测试流量；优先级结论要和更长时间窗口对齐（建议 30 天）。

### Vercel Speed Insights（真实用户 RUM，Desktop，Last 7 Days）

> 时间范围：`Dec 26 '25, 11am - Jan 2 '26, 11:59am`，环境：Production，设备：Desktop（报告基于
> `1,264` datapoints）

**全站概览（p75）**：

- RES：`69`
- FCP：`2.66s`
- LCP：`5.74s`
- INP：`40ms`（p99 存在极端离群值，先按“非主要矛盾”处理）
- CLS：`0.02`
- TTFB：`2.04s`

**路由拖累点（p75）**：

- LCP（差）：`/feed` `30416ms`（23 datapoints）、`/archive`
  `6332ms`（17）、`/tags/[slug]` `6144ms`（10）、`/blog`
  `7728ms`（8）、`/blog/[slug]` `8308ms`（9）
- TTFB（差）：`/feed` `6077ms`（24）、`/tags/[slug]` `6098ms`（10）、`/`
  `3562ms`（36）

> 备注：Mobile 维度当前无有效数据点（可能是无移动端访问或样本不足），后续需补齐。

结论：**RUM 视角下，主要矛盾是 “TTFB 偏高 + LCP 严重偏高（尤其
`/feed`）”**。同时内监控显示 `/api/user`、`/api/activities`
等接口“高频且慢”，并被重复请求/预取放大。P0 必须同时做：先止血（预取/去重）再降本（签名/缓存/并发），并优先把
`/feed` 的“数据+首屏渲染”拉回可用区间。

---

## Preview 实测（2026-01-02，Vercel Preview + Chrome DevTools MCP）

> Preview（alias）：https://jiknsblog-git-perf-phase0-preview-jikns-projects.vercel.app
> Preview（deployment）：https://jiknsblog-lolr2uofn-jikns-projects.vercel.app
> Inspect：https://vercel.com/jikns-projects/jikns_blog/ERTJ5k8Rh6AkRRXcP7Ui7dx2ADH6
> 说明：实验室数据（未限速 / 未 CPU throttling），口径：随机域 +
> `ignoreCache=true`，用于验证“止血 + 降本”是否真的落地到线上环境。

### Core Web Vitals（lab，No throttling）

- `/`：LCP `600ms`（TTFB `196ms`，render delay `404ms`，CLS `0.00`）
- `/feed`：LCP `2293ms`（TTFB `580ms`，render delay `1713ms`，CLS `0.00`）
- `/blog`：LCP `1285ms`（TTFB `187ms`，render delay `1098ms`，CLS `0.00`）
- `/blog/[slug]`（`/blog/e2e-perf-preview-20251231`）：LCP `794ms`（TTFB
  `182ms`，render delay `612ms`，CLS `0.00`）
- `/tags`：LCP `1039ms`（TTFB `183ms`，render delay `857ms`，CLS `0.00`）
- `/tags/[slug]`（`/tags/e2e`）：LCP `469ms`（TTFB `195ms`，render delay
  `274ms`，CLS `0.00`）
- `/archive`：LCP `394ms`（TTFB `186ms`，render delay `208ms`，CLS `0.00`）
- `/archive/[year]/[month]`（`/archive/2025/12`）：LCP `487ms`（TTFB
  `184ms`，render delay `302ms`，CLS `0.00`）

### Network（关键断言）

- ⚠️ Preview 默认开启 Vercel 访问保护；要验证“未登录”需先在站内登出（保留 Vercel
  Cookie），否则 `fetch(credentials: "omit")` 会触发 Vercel 的
  `401 text/html`（非应用逻辑）。
- 生产环境未登录访问 `/feed`、`/blog` 会下载
  `/_next/static/chunks/446-*.js`（Supabase 相关 chunk）；Preview 未登录已不再下载（P0-0.12）
- 未登录调用 `/api/users/suggested` 返回 `401 application/json`（不再 307 →
  `/login` 重定向链）
- `/blog` 首次加载无 `/api/posts` fetch/xhr（避免无意义 RTT 与后端压力）
- `/blog`、`/blog/[slug]` 响应头包含 `x-nextjs-prerender: 1` 且
  `x-nextjs-stale-time`（已进入可缓存路径）
- 未登录访问 `/blog/[slug]`：不请求
  `/api/likes?action=status`、`/api/bookmarks?action=status`；不预取
  `/login?_rsc=...`（只在交互时按需请求）
- `/favicon.ico` 返回 `200`（不再 404）
- `/api/users/[id]/following` 首屏请求显式带 `includeTotal=false`，响应
  `meta.pagination.total=null`（避免 COUNT(\*) 热点）；页面总数来自
  `/api/users/[id]/public` 的 `counts.following`

### Preview E2E 回归（2026-01-02，Chrome DevTools MCP）

- ✅ Phase
  1：公开页（`/`、`/blog`、`/blog/[slug]`、`/feed`、`/search?q=e2e`、`/tags/e2e`、`/archive`、`/archive/2025/12`、`/about`、`/privacy`、`/terms`、`/subscribe`、`/login`）
- ✅ Phase 2：搜索（`/search?q=e2e`、空结果 `q=__no_such_term__`）
- ✅ Phase 2A：标签详情（`/tags/e2e`、`/tags/e2e?sort=viewCount`）
- ✅ Phase 2B：档案导航（`/archive/2025/12`）
- ✅ Phase 2/2A：搜索 + 标签（以 `e2e` 数据验证）
- ✅ Phase 3：登录（GitHub
  OAuth，跳转到稳定 Preview 域完成回调）、会话持久化（含后台 `/admin/*`）
- ✅ Phase 7：通知（dropdown 按需拉列表；`/notifications` 页面可用）
- ✅ Phase 8：管理后台（`/admin/blog`、`/admin/monitoring`）
- ✅ Phase 4：博客写交互（`/blog/e2e-perf-preview-20251231`
  点赞/评论/回复/删除/收藏，均已清理 `[E2E-TEST]`）
- ✅ Phase 6：动态写交互（`/feed`
  评论 create/delete；关注/取消关注并恢复原状态；点赞状态恢复）

### 回归阻塞：Preview 登录流（✅ 已修复）

约束：Supabase GitHub OAuth 的 `redirect_to`
需要命中 allowlist；如果回调域名不稳定（例如访问 `dpl_*`
域），很容易不在 allowlist 内导致登录失败/跳域。

修复（应用侧）：Preview 环境把 callback
base 归一化到“稳定域”，避免落到随机部署域：

- 优先用 `NEXT_PUBLIC_SITE_URL`（如果配置且匹配当前分支；或是自定义 preview 域）
- 否则基于 `VERCEL_GIT_COMMIT_REF` + `request.hostname` 推导
  `*-git-<ref>-*.vercel.app` 分支稳定域

- `lib/auth/resolve-auth-base-url.ts`：避免 `NEXT_PUBLIC_SITE_URL`
  跨分支误用；并尝试把随机域映射回分支稳定域
- Supabase allowlist 需要覆盖分支域的
  `https://*-git-<ref>-*.vercel.app/auth/callback`（或使用更宽的匹配规则）

### 项目内监控（Preview，/api/admin/monitoring，过去 24 小时）

- 汇总：总请求数 `1792`，平均响应时间 `2728ms`，慢请求率 `79.02%`，错误率
  `0.00%`
- 认证会话检查（`AUTH_SESSION_CHECK_TIME`）：平均 `427ms`，P95 `879ms`
- 权限检查（`PERMISSION_CHECK_TIME`）：平均 `431ms`，P95 `879ms`
- 当前 Top 慢接口（avg）：`/api/activities` `4056ms`（47）、`/api/comments`
  `3805ms`（50）

## 数据来源与客观性（如何对账）

本方案不靠“单次 DevTools 跑分拍脑袋”，而是用
**RUM（真实用户）+ 流量入口 + 服务端监控** 三方互证：

| 数据源                             | 类型            | 主要覆盖                            | 适合回答的问题                       | 盲区                                            |
| ---------------------------------- | --------------- | ----------------------------------- | ------------------------------------ | ----------------------------------------------- |
| Chrome DevTools MCP trace          | 实验室（lab）   | 单次加载的主线程、渲染延迟、Network | “慢在哪里（渲染/脚本/请求）？”       | 不代表真实用户分布（设备/网络/缓存/冷启动占比） |
| Vercel Speed Insights              | 真实用户（RUM） | 路由维度 LCP/INP/CLS/TTFB 分位      | “影响用户的真实慢点/占比是多少？”    | 需要 24-48h 流量窗口；无法解释具体代码栈        |
| Vercel Web Analytics               | 真实流量        | Top pages / Entry pages / Bounce    | “先优化谁（流量最大/跳出最高）？”    | 不直接告诉你渲染/后端谁慢                       |
| 项目内监控（`performanceMonitor`） | 服务端客观计时  | API 响应时间、权限/会话检查         | “哪个 API 最慢/最频繁？是否被放大？” | 不覆盖浏览器渲染（render delay/INP）            |

**对账规则（用来判定根因与优先级）**：

- Speed Insights 的 **p75 TTFB 高**，且内监控显示相同接口/路由的
  **API_RESPONSE_TIME 高** ⇒ 先修后端（DB/外部依赖/冷启动）。
- Speed Insights 的 **LCP 高但 TTFB 不高**，且 DevTools 显示 **render delay/long
  tasks** ⇒ 先修前端（首屏 JS、Hydration、骨架、图片、布局抖动）。
- 单页 Network 出现大量
  `?_rsc=...`、并且内监控平均响应时间被拉高 ⇒ 先停掉高成本 Link 预取（不要让“没点击的页面”消耗服务器）。
- 单页多次 `/api/user`，且内监控 `/api/user` 同时“频繁 + 慢”
  ⇒ 先做调用去重（削峰），再做 `/api/user` 单次降本（并发/缓存/去同步）。

**可选（更强一致性）**：启用 Vercel **Speed Insights Drains**
把 RUM 事件落到你自己的监控里，实现“前端 vitals + 后端 API”同屏分析（按需采样即可）。

## 问题诊断

### 0. 全站冗余请求与预取

| 问题                                                                           | 文件                                                                                            | 影响                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Link 默认 prefetch 触发大量 `_rsc` 预取（导航/标签列表等）                     | `components/navigation-server.tsx`、各列表页 Link                                               | 首屏额外 SSR/DB 开销、请求数暴涨、服务器被预取拖慢                            |
| `/api/user` 重复请求                                                           | `app/providers/auth-provider.tsx`、`components/navigation-auth-actions.tsx`                     | 同页 3-4 次请求，浪费 RTT；连带触发重复签名 URL                               |
| `/blog` 首屏重复请求 `/api/posts?page=1`（已修复）                             | `components/blog/blog-list-client.tsx`                                                          | 额外请求放大首屏耗时与后端压力                                                |
| `/api/user` 单次请求成本过高（同步 + 签名）                                    | `app/api/user/route.ts`                                                                         | 每次请求都 `syncUserFromAuth()` + 生成签名 URL；在“重复请求/预取”下被指数放大 |
| CSRF token 全局初始化（已修复：不再全局请求）                                  | `components/security/csrf-token.tsx`、`lib/security/csrf-client.ts`                             | 读页面不应再请求 `/api/csrf-token`；仅写请求按需 ensure                       |
| 通知铃铛默认拉取 + 定时刷新（✅ 修复：首屏仅拉 unreadCount，列表按需）         | `components/notifications/notification-bell.tsx`、`app/api/notifications/unread-count/route.ts` | 首屏不再拉通知列表；未读角标仅用轻量计数接口，列表在 dropdown 打开时才请求    |
| 未登录访问受保护 API 被 307 重定向到 `/login`（已修复：API 统一返回 JSON 401） | `middleware.ts`                                                                                 | fetch 解析失败 + SWR 重试放大请求量（典型：`/api/users/suggested`）           |
| 签名头像不可缓存 + 尺寸过大                                                    | `lib/storage/signed-url.ts`、`/api/user`                                                        | token 变化导致缓存击穿；640×640 渲染 32×32，浪费带宽                          |

### 1. 页面渲染问题

| 问题                                                                                       | 文件                                                                                         | 影响                                                                  |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 博客详情页串行请求                                                                         | `app/blog/[slug]/page.tsx` L142-175                                                          | TTFB +300-500ms                                                       |
| loading.tsx 缺骨架屏（已补齐主要路由）                                                     | `app/*/loading.tsx`                                                                          | 感知性能差                                                            |
| 搜索页纯 CSR                                                                               | `app/search/search-page-client.tsx`                                                          | 首屏空白                                                              |
| Feed 首屏仍以 render delay 为主（复测 LCP `1965ms` / TTFB `63ms`）                         | `app/feed/page.tsx`、`hooks/use-activities.ts`                                               | 主要矛盾从“白屏”转为“主线程渲染/水合延迟”，继续压首屏 JS 与非关键请求 |
| 博客详情页 `force-dynamic`                                                                 | `app/blog/[slug]/page.tsx` L45-46                                                            | 失去缓存能力，冷启动波动大                                            |
| 归档页缓存策略缺失（已对 `/archive`、`/archive/[year]`、`/archive/[year]/[month]` 加 ISR） | `app/archive/page.tsx`、`app/archive/[year]/page.tsx`、`app/archive/[year]/[month]/page.tsx` | 冷启动/DB 抖动会直接反映在 TTFB/LCP                                   |
| 标签/博客页因 Tag 限流读取 `headers()` 导致 ISR 失效                                       | `lib/actions/tags/queries.ts`、`app/tags/*`、`app/blog/page.tsx`                             | 路由 TTFB 偏高（RUM：`/tags/[slug]` p75 TTFB `6.1s`），并放大 LCP     |

### 2. 数据层问题

| 问题                                      | 文件                              | 影响                                    |
| ----------------------------------------- | --------------------------------- | --------------------------------------- |
| Posts 缓存缺失（✅ 已补齐：P1-1.1）       | `lib/actions/posts.ts`            | 重复数据库查询                          |
| count 查询未合并                          | `lib/repos/post-repo.ts` L298-324 | 多余 DB 往返                            |
| 签名 URL 串行调用                         | `lib/actions/posts.ts`            | API 延迟                                |
| 签名 URL 缺少跨请求缓存（同资源反复签名） | `lib/storage/signed-url.ts`       | token 不稳定导致浏览器/CDN 缓存命中率差 |

### 3. 前端 Bundle 问题

| 问题                                               | 影响                                          |
| -------------------------------------------------- | --------------------------------------------- |
| 31 个 Radix UI 包全量打包                          | ~100-150KB 冗余                               |
| MarkdownRenderer 仍使用 `<img>`（不走 next/image） | 需用 render API + srcSet/sizes 控制带宽与 LCP |
| 超大组件（sidebar 694行）                          | 首屏加载慢                                    |
| 初始 Bundle 约 591KB                               | 远超理想值                                    |

### 4. 已有的良好实践

- ✅ 动态导入策略（recharts、markdown-editor）
- ✅ lucide-react 已配置 modularizeImports
- ✅ 部分组件使用 memo() 和虚拟化
- ✅ Promise.all 并发查询（部分场景）

---

## 优化方案

### Phase 0: 快速胜利（预计 2 天）

#### 0.1 禁用高成本 Link 预取（优先级 P0）

**现象**：任意页面加载后会自动触发多个 `?_rsc=...`
预取（`/feed`、`/admin`、`/tags/[slug]`
等），导致“首屏加载慢 + 跳转也慢（服务器被预取压垮）”。

**目标**：主导航与大列表页默认不做 prefetch；需要时改成 hover/idle 再 prefetch。

**涉及文件**：

- `components/navigation-server.tsx`
- 其他大列表页（标签列表、归档列表、Feed 列表）中的 Link

**预期收益**：首屏请求数显著下降，后端压力下降，TTFB 抖动减少。

#### 0.2 统一用户态数据源，消除 `/api/user` 重复请求（优先级 P0）

**现象**：同页 3-4 次 `/api/user` 请求（AuthProvider + 导航栏 SWR
fallback 等叠加）。

**涉及文件**：

- `app/providers/auth-provider.tsx`
- `components/navigation-auth-actions.tsx`

**策略**：

- 只保留一个“权威来源”（建议：AuthProvider），其余组件不再自行请求 `/api/user`
- 需要兜底时，走同一个 SWR key / 同一个 fetcher，并确保 dedupe 生效

**同时做后端降本（同属 P0）**：

- `app/api/user/route.ts`：把 `syncUserFromAuth()`
  改成后台任务/按需触发（不要阻塞响应）
- `app/api/user/route.ts`：头像/封面签名改为 `Promise.all` 并发（不要串行）
- `lib/storage/signed-url.ts`：in-memory TTL cache + 使用 Supabase Storage
  `createSignedUrls` 做按 bucket 的批量签名；并在 `signActivityListItems`
  做列表级去重签名（头像/图片），显著减少外部 Storage 往返

#### 0.3 CSRF token 按需加载（优先级 P0）

**现象**：读页面也会触发一次 `/api/csrf-token`。

**涉及文件**：

- `app/layout.tsx`（全局引入了 `<CSRFToken />`）
- `components/security/csrf-token.tsx`

**策略**：

- 移除全局 `<CSRFToken />`，仅在需要原生 form 提交的页面引入
- JS 发起的写请求统一走 `fetchJson()`（已内置 ensureCsrfToken）

#### 0.4 Feed 首屏可见（优先级 P0）

**现象**：RUM 维度 `/feed` 历史上是全站最大拖累点；当前 Production lab
trace（2026-01-03）LCP `688ms`（TTFB `397ms`，render delay
`290ms`），仍需等待 Speed Insights 新窗口验证真实用户分位。

**涉及文件**：

- `app/feed/page.tsx`
- `hooks/use-activities.ts`（`revalidateOnMount/onFocus`
  造成额外请求与渲染抖动）
- `components/feed/feed-page-client.tsx`（首屏加载的依赖与动态导入策略）

**策略**（先做最小改动跑通可见性）：

- 让首屏在没有数据时也能立即渲染空态/骨架（而不是等待客户端请求完成）
- 降低首屏必须加载的 JS：延后低频对话框/编辑器等依赖
- 服务端必须注入 `viewerId`（否则 following SSR 为空，客户端首屏再拉
  `/api/activities`，把 render delay 拉爆）
- 非关键请求（`/api/notifications`、`/api/users/suggested`）延后到 idle/交互触发，避免和首屏争抢主线程与带宽
- 对齐 RUM：优先压低 `/feed` 的 p75 TTFB/LCP（配合 `/api/activities`
  与签名 URL 降本）

**状态（✅ 已实现，✅ 已上线并复验）**：

- `app/feed/page.tsx`：改为 ISR（`export const revalidate = 30`），默认
  `latest`，避免每次请求都执行 DB/签名链路
- `app/feed/page.tsx`：并行化 `getFeatureFlags()` 与
  `fetchInitialActivities()`（`Promise.all`），降低首屏 TTFB（Production
  trace：TTFB `397ms`；2026-01-03）
- `components/feed/feed-list.tsx`：移除
  `react-virtuoso`，减少首屏复杂度与潜在长任务
- `components/notifications/notification-bell.tsx`：首屏仅请求未读数（默认 1.5s
  idle），通知列表仅在 dropdown 打开时请求；移除轮询
- `components/feed/suggested-users-card.tsx`：延迟触发首屏非关键请求（默认 1.5s
  idle），并确保未登录不触发
- `middleware.ts`：受保护 API 未登录统一返回 JSON 401，避免 307 → `/login`
  重定向链放大请求

#### 0.5 博客详情页并行化

**文件**: `app/blog/[slug]/page.tsx`

**当前代码** (L142-175):

```typescript
// 串行执行 - 问题
const result = await getPost(slug)              // ~100-150ms
await getPost(slug, { incrementView: true })    // ~50-80ms
const currentUser = await getCurrentUser()      // ~50-100ms
await prisma.follow.findUnique(...)             // ~30-50ms
```

**优化后**:

```typescript
// 并行获取
const [result, currentUser] = await Promise.all([
  getPost(slug, { incrementView: false }),
  getCurrentUser(),
])

if (!result.success || !result.data?.published) {
  notFound()
}

// 异步增加浏览量（fire-and-forget）
incrementViewCount(result.data.id).catch(console.error)

// 关注关系可后续处理或并行
```

**预期收益**: TTFB 减少 200-350ms

#### 0.6 骨架屏实现

**需修改文件**:

- `app/blog/loading.tsx`
- `app/blog/[slug]/loading.tsx` (新建)
- `app/feed/loading.tsx`
- `app/admin/blog/loading.tsx`
- `app/search/loading.tsx`

**示例**:

```typescript
// app/blog/loading.tsx
export default function BlogListLoading() {
  return (
    <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-6 lg:grid-cols-12">
      <main className="col-span-1 lg:col-span-8">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted/30 h-40 animate-pulse rounded-xl" />
          ))}
        </div>
      </main>
      <aside className="hidden lg:col-span-4 lg:block">
        <div className="bg-muted/30 h-64 animate-pulse rounded-xl" />
      </aside>
    </div>
  )
}
```

#### 0.7 修复静态资源 404（优先级 P0）

**现象**：线上 `GET /favicon.ico` 返回 404。

#### 0.8 /blog 首屏冗余请求去除（✅ 已修复）

**现象**：`/blog` 首次加载会额外触发一次
`/api/posts?page=1`（即便 SSR 已有首屏数据）。

**根因**：`components/blog/blog-list-client.tsx` 中对 SWRInfinite 的
`setSize(1)` 进行了无条件 `useEffect` 调用，导致 mount 时触发 revalidate。

**修复**：移除该 `useEffect`，依赖 SWRInfinite 默认 `persistSize=false`
在 key 变化时自动重置页数。

**复验口径（Preview + DevTools MCP）**：

- Network：`/blog` 首次加载无 `/api/posts` fetch/xhr
- Trace：`/blog` LCP `574ms`（TTFB `186ms`）

---

### Phase 1: 缓存层优化（预计 3 天）

#### 1.1 Posts 添加 unstable_cache（✅ 已实现）

**文件**: `lib/actions/posts.ts`

**实现摘要**：

- `getPosts`：仅缓存 `published: true`
  的公开列表（避免草稿/管理态进入共享缓存），tag `posts:list`，`revalidate: 30`
- `getPost`：仅缓存 slug 详情（UUID 查询/`incrementView` 不缓存），tag
  `posts:detail`，`revalidate: 60`
- 写操作：统一 `revalidatePostsCache()`（`revalidateTag("posts:list")` +
  `revalidateTag("posts:detail")`）

```typescript
import { unstable_cache } from "next/cache"

// 缓存文章详情
const getCachedPost = unstable_cache(
  async (slug: string) => {
    // 现有 getPost 逻辑（不含浏览量增加）
  },
  ["post", "detail"],
  { tags: ["posts:detail"], revalidate: 60 }
)

// 缓存文章列表
const getCachedPosts = unstable_cache(
  async (params: PostsSearchParams) => {
    // 现有 getPosts 逻辑
  },
  ["posts", "list"],
  { tags: ["posts:list"], revalidate: 30 }
)
```

#### 1.2 博客列表启用 ISR

**文件**: `app/blog/page.tsx`

```typescript
export const revalidate = 60 // 60秒增量静态再验证
```

**状态**：✅ 已实现 + ✅ 已上线（Production）。同时对 `app/archive/page.tsx`
增补 `export const revalidate = 60`，优先压低公开页 TTFB 抖动。

#### 1.3 缓存失效触发

在写操作后调用:

```typescript
import { revalidateTag } from "next/cache"

// createPost/updatePost/deletePost 后
revalidateTag("posts:list")
revalidateTag("posts:detail")
```

#### 1.4 Signed URL 稳定化（避免 token 变化导致缓存击穿）

**文件**: `lib/storage/signed-url.ts`

**目标**：对同一 (bucket,path) 的签名结果做跨请求缓存（缓存周期 <
expiresIn），让客户端拿到稳定 URL，从而浏览器/Next Image/CDN 可缓存。

**状态**：✅ 已实现 + Preview 已复验：重复请求同一资源（如头像）返回稳定 signed
URL，`/api/user` 响应头 `x-perf-sign-ms` 约为 `0ms`。

---

### Phase 2: Bundle 优化（预计 3 天）

#### 2.1 Radix UI 低频组件动态导入

**目标组件**:

- `@radix-ui/react-alert-dialog` → 删除确认场景
- `@radix-ui/react-context-menu` → 右键菜单
- `@radix-ui/react-hover-card` → 悬浮卡片

**模式**:

```typescript
import dynamic from "next/dynamic"

const AlertDialog = dynamic(() => import("@/components/ui/alert-dialog"), {
  ssr: false,
})
```

**预期收益**: 首屏 Bundle 减少 30-50KB

#### 2.2 大型组件拆分

| 文件                                        | 当前行数 | 拆分建议                                                      |
| ------------------------------------------- | -------- | ------------------------------------------------------------- |
| `components/ui/sidebar.tsx`                 | 694      | sidebar-layout + sidebar-nav + sidebar-user + sidebar-footer  |
| `components/search/search-filters.tsx`      | 614      | search-bar + filter-chips + sort-selector + date-range-picker |
| `components/admin/monitoring-dashboard.tsx` | 569      | dashboard-layout + metrics-cards + charts                     |

#### 2.3 Bundle 分析

```bash
ANALYZE=true pnpm build
```

识别其他大型依赖并针对性优化。

---

### Phase 3: 图片优化（预计 2 天）

#### 3.1 扩展 next/image 覆盖

**查找未优化图片**:

```bash
grep -r "<img" components/ app/ --include="*.tsx" | grep -v "next/image"
```

**替换模式**:

```typescript
import Image from "next/image"

<Image
  src={src}
  alt={alt}
  width={800}
  height={600}
  sizes="(max-width: 768px) 100vw, 800px"
  loading="lazy"
  quality={75}
/>
```

#### 3.2 首屏图片预加载

**文件**: `app/blog/[slug]/page.tsx`

```typescript
// 在 head 中预加载封面图
<link rel="preload" as="image" href={post.coverImage} />
```

---

### Phase 4: 数据库优化（预计 1 天）

#### 4.1 count 查询合并

**文件**: `lib/repos/post-repo.ts` (L298-324)

**当前**: 4 个分开的 count 查询

```typescript
const publishedCount = await prisma.post.count({ where: { published: true } })
const draftsCount = await prisma.post.count({ where: { published: false } })
const pinnedCount = await prisma.post.count({ where: { isPinned: true } })
const totalCount = await prisma.post.count({})
```

**优化后**:

```typescript
const stats = await prisma.post.groupBy({
  by: ["published", "isPinned"],
  where: whereForCounts,
  _count: true,
})

// 应用层聚合
const publishedCount = stats
  .filter((s) => s.published)
  .reduce((a, s) => a + s._count, 0)
const draftsCount = stats
  .filter((s) => !s.published)
  .reduce((a, s) => a + s._count, 0)
const pinnedCount = stats
  .filter((s) => s.isPinned)
  .reduce((a, s) => a + s._count, 0)
```

#### 4.2 批量签名 URL

已实现（P0）：`createSignedUrls` 按 bucket 聚合并调用 Supabase Storage
`createSignedUrls`；`signActivityListItems`
对列表内头像/图片做去重后批量签名，避免逐个签名。

---

### Phase 5: Vercel 特定优化（预计 1 天）

#### 5.0 用 Speed Insights + Analytics 驱动优先级（先做对的页面）

- **Analytics**：按 Top pages / Entry pages
  / 跳出率，确定 P0 页面（不要凭感觉优化）
- **Speed Insights**：按路由看 LCP/INP/CLS/TTFB 分布，区分 cold start 与稳定慢
- 每轮改动后对比：Speed Insights（真实用户） + 本文档的 DevTools lab 基线

#### 5.1 Edge Runtime 候选

轻量级 API 迁移到 Edge:

```typescript
// app/api/posts/[slug]/view/route.ts
export const runtime = "edge"

// app/api/health/route.ts
export const runtime = "edge"
```

#### 5.2 Streaming SSR

**文件**: `app/blog/[slug]/page.tsx`

```typescript
import { Suspense } from "react"

export default async function BlogPostPage({ params }) {
  return (
    <>
      <Suspense fallback={<ArticleSkeleton />}>
        <ArticleContent slug={params.slug} />
      </Suspense>
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsSection postId={post.id} />
      </Suspense>
    </>
  )
}
```

---

## 关键文件清单

| 优先级 | 文件                                       | 改动类型                                              |
| ------ | ------------------------------------------ | ----------------------------------------------------- |
| P0     | `components/navigation-server.tsx`         | 禁用高成本 prefetch                                   |
| P0     | `components/navigation-auth-actions.tsx`   | 去掉 `/api/user` 重复请求                             |
| P0     | `middleware.ts`                            | API 未登录返回 JSON 401（避免 307→`/login` 重定向链） |
| P0     | `app/api/user/route.ts`                    | 降低 `/api/user` 单次成本（去同步/并发签名）          |
| P0     | `lib/storage/signed-url.ts`                | Signed URL 缓存/稳定化（减 TTFB/LCP）                 |
| P0     | `app/layout.tsx`                           | 移除全局 CSRF 初始化                                  |
| P0     | `components/security/csrf-token.tsx`       | CSRF 按需加载                                         |
| P0     | `app/feed/page.tsx`                        | 首屏可见性（FCP/LCP）                                 |
| P0     | `hooks/use-activities.ts`                  | 降低首屏 revalidate 抖动                              |
| P0     | `hooks/use-suggested-users.ts`             | 未登录/无权限不重试（避免无意义请求）                 |
| P0     | `components/feed/suggested-users-card.tsx` | 登录态才触发推荐用户请求                              |
| P0     | `app/api/activities/route.ts`              | 降低 feed API 成本（签名/批量状态/缓存）              |
| P0     | `lib/actions/tags/queries.ts`              | SSR 场景跳过 Tag 限流（解锁 ISR）                     |
| P0     | `app/tags/page.tsx`                        | ISR + 避免动态 `headers()`                            |
| P0     | `app/tags/[slug]/page.tsx`                 | ISR + 避免动态 `headers()`                            |
| P0     | `app/archive/[year]/page.tsx`              | ISR 配置                                              |
| P0     | `app/archive/[year]/[month]/page.tsx`      | ISR 配置                                              |
| P0     | `app/blog/[slug]/page.tsx`                 | 并行化 + Streaming                                    |
| P0     | `app/blog/loading.tsx`                     | 骨架屏                                                |
| P0     | `app/feed/loading.tsx`                     | 骨架屏                                                |
| P1     | `lib/actions/posts.ts`                     | unstable_cache                                        |
| P1     | `app/blog/page.tsx`                        | ISR 配置                                              |
| P1     | `app/archive/page.tsx`                     | ISR 配置                                              |
| P2     | `components/ui/alert-dialog.tsx`           | 动态导入包装                                          |
| P2     | `components/ui/sidebar.tsx`                | 拆分                                                  |
| P2     | `components/search/search-filters.tsx`     | 拆分                                                  |
| P3     | 使用 `<img>` 的组件                        | 替换为 next/image                                     |
| P3     | `lib/repos/post-repo.ts`                   | groupBy 优化                                          |
| P4     | `app/api/*/route.ts` (轻量级)              | Edge Runtime                                          |

---

## 复验流程（每轮优化必做）

1. **部署 Preview**：所有改动先上 Preview 环境（保持同一组测试账号/数据口径）。
2. **性能复验（Chrome DevTools MCP）**：
   - 路由：`/feed`、`/blog`、`/blog/[slug]`（必要时补 `/archive`、`/tags`）
   - Network：确认无 `307 → /login` 重定向链、无异常 `_rsc`
     预取放大、`/api/user` 不重复请求
   - 记录：LCP/TTFB/render delay（同一口径：`ignoreCache=true`，No
     throttling；可加一轮 CPU 4x 作为压力测试）
3. **功能回归**：按 `docs/e2e-production-test-plan.md` 回归（重点 Phase
   1/3/4/5/6，确保登录/交互/资料页无破坏）。
4. **Production 回归**：Preview 通过后再发 Production，并复跑上述第 2-3 步（遵守“只读优先/无残留数据/低频请求”）。

## 风险与注意事项

### 预取相关

- 禁用 prefetch 可能降低“秒开跳转”的体感，但能显著降低首屏请求数与后端压力
- 折中方案：仅对高频/轻量页面保留 prefetch，其余改为 hover/idle 再 prefetch

### 缓存相关

- 用户可能短暂看到旧数据
- 需确保 `revalidateTag` 在写操作后正确调用
- 个性化内容（关注状态、点赞）需走客户端获取

### Bundle 优化

- 动态导入可能导致 SSR/CSR 水合不匹配
- 使用 `ssr: false` 规避，但会影响 SEO（对低频组件影响小）

### 数据库

- `groupBy` 在大数据量下可能比多个 `count` 慢
- 已有 `prisma.$transaction` 超时问题，需监控

### 测试

- 每个 Phase 完成后运行 `pnpm test` 和 `pnpm build`
- 部署前在 Vercel Preview 环境验证

---

## 验收标准

- [x] Lighthouse Performance 分数 ≥ 80（Production，mobile preset，simulate
      throttling，3 runs median：`/` 95、`/blog/e2e-perf-preview-20251231`
      91；2026-01-03）
- [x] 博客详情页 TTFB < 500ms（Production，`ignoreCache=true` reload
      ×3，TTFB(ms): 322/432/139，median 322；2026-01-03）
- [x] 首屏 JS Bundle < 400KB（Production，`ignoreCache=true`
      reload，PerformanceResourceTiming 统计 `/_next/*.js` `transferSize`：`/`
      163KB、博客详情 232KB；2026-01-03）
- [x] 所有主要页面有骨架屏（`/blog`、`/blog/[slug]`、`/feed`、`/archive`、`/search`
      有 `loading.tsx`；`/activities`、`/tags`、`/tags/[slug]` 使用
      `<Suspense fallback=...>`；`/` 至少覆盖 LatestContent）
- [x] `pnpm build` 无错误（本地构建通过；Next build 输出 `First Load JS`：`/`
      129kB、`/blog/[slug]` 213kB；2026-01-03）
- [x] `pnpm test:critical` 通过（WSL 跑全量 `pnpm test`
      易崩，建议交给 CI；2026-01-03）
- [x] Lab Web Vitals 预检（Chrome DevTools MCP，`ignoreCache=true`
      reload，无 throttling；2026-01-03）：`/` LCP `323ms` CLS `0.00`；`/feed`
      LCP `688ms` CLS `0.06`；`/search?q=Next.js` LCP `374ms` CLS
      `0.00`；`/tags` LCP `550ms` CLS `0.00`；`/archive` LCP `524ms` CLS
      `0.00`；交互 INP `32ms`（`/feed` 点击“热门/最新”）
- [ ] Field Web Vitals 达标（Vercel Speed Insights / RUM p75：LCP < 2.5s, INP <
      200ms, CLS < 0.1；需要 24-48h 数据窗口）
- [x] `/feed` 首屏 TTFB < 500ms（Production，`ignoreCache=true` reload；TTFB
      `397ms`；2026-01-03）
- [x] 单次页面加载：`/api/user` ≤ 1；读页面不再请求
      `/api/csrf-token`（Production：`/`、`/tags`、博客详情均验证；2026-01-03）
- [x] 首页/标签页不再触发 `/admin`、`/feed` 等高成本 `_rsc`
      预取（Production：`/`、`/tags` fetch/xhr 无 `?_rsc=`；2026-01-03）

## 复验流程（建议固定为每次发布的必做项）

- 参考：`docs/e2e-production-test-plan.md` Phase 9（性能与错误监控）
- Chrome DevTools MCP：对 `/`、`/feed`、`/search?q=Next.js`、`/tags`、`/archive`
  各跑 1 次 `performance_start_trace`，记录 LCP/TTFB/FCP + network 请求列表
- Vercel Speed
  Insights：发布后观察 24-48h（至少一个流量周期），按路由对比 p75 的 LCP/INP/TTFB
- Vercel Analytics：对齐 Top pages / Entry
  pages 的跳出率与平均停留，避免“优化了没人看的页面”

---

## 实施时间线

```
Week 1:
├── Day 1-2: Phase 0 (快速胜利)
│   ├── 并行化详情页请求
│   └── 实现骨架屏
│
├── Day 3-5: Phase 1 (缓存层)
│   ├── 添加 unstable_cache
│   └── 配置 ISR

Week 2:
├── Day 1-3: Phase 2 (Bundle)
│   ├── 动态导入低频 Radix 组件
│   └── 拆分大型组件
│
├── Day 4-5: Phase 3-5 (图片 + DB + Vercel)
│   ├── 扩展 next/image
│   ├── 优化 count 查询
│   └── Edge Runtime 迁移
```

---

## 参考资源

- [Next.js Caching](https://nextjs.org/docs/app/building-your-application/caching)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [React Suspense](https://react.dev/reference/react/Suspense)
- [Web Vitals](https://web.dev/vitals/)
