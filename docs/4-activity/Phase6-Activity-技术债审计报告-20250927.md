# Phase 6：Activity 模块技术债审计报告（2025-09-27）

## 背景

在 Posts 模块完成 P2 验收后，团队计划把精力转向 Activity 模块，目标是在 Phase
6 范围内彻底收敛残留技术债，确保动态流（Activity
feed）在发布、浏览、互动各环节的可靠性与扩展性。本次审计基于 2025-09-27 主干分支代码，聚焦服务端 API、仓储层、前端 Hook/组件以及配套的权限与限流设施。

## 范围与方法

- **代码静态审查**：`app/api/activities/**`、`lib/repos/activity-repo.ts`、`hooks/use-activities.ts`、`components/activity/**`
  等核心实现。
- **架构依赖梳理**：核对
  `lib/permissions/activity-permissions.ts`、`lib/interactions/likes.ts`、`lib/rate-limit/activity-limits.ts`
  与 Activity 业务的耦合点。
- **文档/测试交叉验证**：比对 `docs/4-activity` 既有计划与
  `tests/api/activities-*.test.ts` 覆盖范围，确认契约与现状是否一致。
- **缺陷推演**：对分页游标、筛选、速率限制等关键路径进行手工推演，验证在真实流量下的行为。

## 核心结论

| 等级 | 问题摘要                                                                      | 证据                                                                  | 影响                                                 | 建议                                                       |
| ---- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| P0   | 游标分页返回 `createdAt`，仓储却按 `id` 取游标，第二页起必触发 Prisma `P2025` | `lib/repos/activity-repo.ts:117-142`、`hooks/use-activities.ts:50-70` | 无限滚动在首屏后直接 500，前端体验崩溃               | 改为返回/消费统一的 `id` 游标，并补充集成测试覆盖          |
| P0   | 前端筛选（置顶/含图）仅做客户端过滤，未追加查询参数                           | `components/activity/activity-list.tsx:62-113`                        | 过滤结果只针对已拉取数据，无法保证全量命中，等同误导 | 为筛选项提供后端参数支持，并在 API 中处理                  |
| P1   | 分页元数据 `total` 仅等于本次返回条目数                                       | `app/api/activities/route.ts:51-58`                                   | 指标、前端分页控件与监控均失真，无法评估真实体量     | 在仓储层补充 `count` 查询或返回可靠游标元数据              |
| P1   | `orderBy=following` 标记 TODO 未实现                                          | `lib/repos/activity-repo.ts:55-61`                                    | 对外宣称支持关注流但实际退化为最新排序，破坏产品预期 | 明确需求：要么实现关注者过滤，要么临时关闭该选项并更新文档 |
| P1   | Activity 限流使用进程内 Map，线上多实例会失效                                 | `lib/rate-limit/activity-limits.ts:59-111`                            | 部署多节点或无状态平台时，速率限制形同虚设           | 落地 Redis/Upstash 等集中式限流，并加上熔断兜底            |
| P2   | 客户端搜索/筛选全部在内存完成                                                 | `components/activity/activity-list.tsx:84-118`                        | 数据量增长后需要多次全量拉取，增加带宽与延迟         | 评估服务端搜索/过滤接口，逐步迁移逻辑                      |

## 详细发现

### P0-1 游标分页游标类型不一致

- **问题**：仓储层 `listActivities` 在生成 `nextCursor` 时返回 `createdAt`
  的 ISO 字符串（`lib/repos/activity-repo.ts:117-122`），而查询游标时却按
  `{ id: cursor }` 传给 Prisma（`lib/repos/activity-repo.ts:72-75`）。前端
  `useActivities` 会把该 ISO 值写入 `cursor`
  查询参数（`hooks/use-activities.ts:63-70`）。当第二页请求到达服务端，Prisma 尝试使用不存在的
  `id`，直接抛出 `P2025`，API 返回 500。
- **影响**：所有依赖无限滚动的页面（Admin
  feed、前台 feed、移动端）在第一页之后均无法继续浏览，用户体验严重受损。
- **建议**：统一游标协议——推荐返回最后一条 activity 的 `id`，分页时配合
  `{ cursor: { id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }`。同时新增契约测试模拟第二页请求，防止回归。

### P0-2 客户端筛选缺乏后端支持

- **问题**：`ActivityList` 将 `hasImages`、`isPinned`
  等过滤条件全部留在前端内存实现（`components/activity/activity-list.tsx:96-118`），请求参数仅包含排序/作者/limit（`components/activity/activity-list.tsx:62-70`）。当用户选择“仅看置顶”时，服务端依旧返回普通列表，只有首屏中恰好返回的置顶动态会显示，无法获取完整数据。
- **影响**：筛选功能名存实亡，运营无法依赖置顶/含图筛选做内容审核；随着 feed 条目增长，用户需要加载多屏数据才有可能看到目标。
- **建议**：在 `ActivityQueryParams` 与 `listActivities` 中增加
  `isPinned`、`hasImages`
  等字段，统一在数据库查询时过滤；若短期无法实现，应在 UI 层隐藏相关选项并在文档中澄清。

### P1-1 分页元数据不可信

- **问题**：活动列表 API 使用 `enrichedItems.length` 作为
  `total`（`app/api/activities/route.ts:51-56`），未统计整体数量，也未返回真实
  `nextCursor`。监控、前端统计或任何依赖 `total` 的逻辑都会被误导。
- **建议**：在仓储层增加
  `prisma.activity.count({ where })`，或在元数据中明确标记
  `approximateTotal`；同时补齐对游标/偏移模式的行为描述。

### P1-2 `orderBy=following` 未实现

- **问题**：仓储层在 `following` 分支仅返回最新排序并标记
  `TODO`（`lib/repos/activity-repo.ts:55-61`），与文档中宣称的关注流不符。
- **影响**：前端/产品相信自己在浏览关注内容，实际却是公共时间线。
- **建议**：若后端还未实现关注关系，应在接口层拒绝 `following`
  选项或快速补齐对应查询（基于关注表或缓存）。

### P1-3 限流实现不适配多实例

- **问题**：`rateLimitCheck` 使用进程内 `Map`
  存储计数（`lib/rate-limit/activity-limits.ts:59-111`），并在模块加载时创建全局定时器。多实例、无状态部署或 serverless 冷启动都会导致限流形同虚设，甚至在 Edge/ISR 环境报错。
- **建议**：使用 Redis/Upstash 等集中式计数；若短期无法接入，至少增加“限流未命中”告警及兜底限制。

### P2-1 搜索/筛选在客户端执行

- **问题**：`ActivityList`
  的全文搜索、图片过滤均在内存实现（`components/activity/activity-list.tsx:96-118`），随着数据量增加，需要多次请求才能筛出结果。
- **建议**：与 P0-2 一并规划，在 API 层支持搜索关键字、图片过滤参数；短期内可限制列表上限或在 UI 提示“筛选基于当前列表”。

## 补充观察

- **置顶权限制定**：`ActivityPermissions.canPin` 已考虑管理员/作者场景，但
  `GET /api/activities` 并未将置顶内容提前排序，后续可评估是否需要固定位置展示。
- **点赞批量状态**：`getBatchLikeStatus`
  已复用活动冗余计数，但缺乏缓存；在 feed 首屏请求量大时，仍需优化。
- **测试覆盖**：当前契约测试仅验证基础 200/401 状态（`tests/api/activities-contract.test.ts`），缺乏分页、筛选、限流等场景，建议补齐。

## 建议路线图

1. **立即修复（P0）**
   - 统一游标类型为 `id` 并补充第二页契约测试。
   - 在 API 与仓储层落地 `isPinned`、`hasImages`
     等查询参数，暂时隐藏未实现的筛选项。
2. **短期优化（P1）**
   - 提供准确的分页元数据；若成本较高，至少清晰标注 `total` 语义。
   - 明确 `following` 行为：实现关注过滤或禁用该选项。
   - 切换限流实现为集中式存储，并加上监控。
3. **后续演进（P2）**
   - 将搜索/过滤能力迁移到服务端，减少前端冗余。
   - 结合监控基线，补充活动模块的错误率、速率限制命中率指标。

## 附件

- 相关代码索引：
  - `app/api/activities/route.ts`
  - `app/api/activities/[id]/route.ts`
  - `lib/repos/activity-repo.ts`
  - `hooks/use-activities.ts`
  - `components/activity/activity-list.tsx`
  - `lib/rate-limit/activity-limits.ts`
- 参考测试：`tests/api/activities-contract.test.ts`
