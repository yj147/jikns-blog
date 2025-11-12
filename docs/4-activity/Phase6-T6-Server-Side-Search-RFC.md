# Phase 6 / T6 RFC：Activity Feed 服务端搜索与筛选迁移

- **撰写日期**：2025-09-27
- **责任小组**：Activity Backend & Frontend
- **关联任务**：Phase6-Activity-技术债整改计划 · 优先级 P2 · T6

## 1. 背景

Activity
Feed 目前的搜索与筛选逻辑几乎全部在客户端执行（`components/activity/activity-list.tsx`）。当数据量增大时，前端需要多次全量拉取才能筛出目标结果，带来如下问题：

1. **结果不完整**：只对已经加载到浏览器内存的数据做过滤，真实结果集可能被截断。
2. **性能劣化**：随着数据增长，前端需要多次分页拉取、拼接再过滤；移动端耗电和带宽成本增加。
3. **排序/筛选不一致**：前端与后端的排序依据不统一，运营指标难以信赖。
4. **监控缺位**：缺乏对搜索/筛选成功率与延迟的可观测性，无法评估体验质量。

T6 的目标是在不破坏现有用户体验的前提下，分阶段把搜索与高级筛选迁移到服务端，最终实现“后端过滤 → 精准传输 → 前端展示”的常规流程。

## 2. 目标与成功指标

### 功能目标

- 支持后端处理以下查询参数：
  - `q`: 文本搜索关键字（支持内容、作者名称、标签）
  - `hasImages`: 已由 T2 上线的服务端过滤继续沿用
  - `isPinned`: 已上线
  - `tags[]`: 标签过滤（未来扩展，预留 schema）
  - `dateRange`: 时间区间过滤（阶段 2 引入）
- 改造前端 Hook 与列表组件，默认使用服务端过滤结果，仅在兜底场景回退到客户端过滤。

### 性能 / 体验指标（验收基准）

- P95 响应时间 < 200ms（无缓存、单页 20 条数据）
- Feed 请求平均带宽下降 ≥ 30%（对比迁移前每页传输量）
- 搜索/筛选请求成功率 ≥ 99%（按监控统计，4xx 参数错误除外）
- 监控面板提供“搜索命中率”、“空结果率”、“关键词 Top10”视图

## 3. 不在范围

- 引入 Elasticsearch / OpenSearch 等新搜索引擎（本阶段仅利用现有 PostgreSQL）
- 对历史活动数据做离线重建或归档
- 推出全局跨模块搜索体验（范围限定在 Activity Feed）

## 4. 约束与假设

- 数据库：PostgreSQL 14（Supabase 托管），可使用 `tsvector`、GIN/GiST 索引。
- ORM：Prisma，需评估 `prisma.$queryRaw` 或 `@prisma/client`
  的全文搜索支持情况。
- 客户端：Next.js App Router + SWR；必须保留无限滚动体验。
- 功能上线需与移动端（如有）保持兼容，旧版本可通过 query fallback 读取。

## 5. 方案概览

### 阶段划分

| 阶段              | 时间窗                  | 目标                                        | 关键交付                                 | 风险开关                              |
| ----------------- | ----------------------- | ------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| Phase 0（已完成） | 2025-09-27              | 服务端化基础筛选（`isPinned`、`hasImages`） | T2/T3/T4 交付                            | N/A                                   |
| Phase 1           | 2025-10-11 ~ 2025-10-18 | 建立搜索基础设施 + API 扩展                 | 数据库索引、`q` 参数、契约测试、监控埋点 | Feature flag `activity_server_search` |
| Phase 2           | 2025-10-19 ~ 2025-10-26 | 扩展筛选维度（时间区间、标签）、客户端切换  | 前端 Hook 改造、UI 更新、成功率监控      | Flag `activity_server_filters`        |
| Phase 3           | 2025-10-27 ~ 2025-11-02 | 优化与回退策略固化                          | 缓存/预热策略、回滚剧本、性能复测        | Dashboard 阈值报警                    |

### 高层架构

1. **数据库层**：在 `activities` 表上新增
   `search_vector`（`tsvector`），包含内容、作者名称、标签；配备 GIN 索引。使用触发器或 Prisma 中间层在写操作时维护字段。
2. **仓储层**：`listActivities` 支持新的
   `searchTerm`、`tags`、`publishedFrom/To` 参数，封装全文搜索与结构化筛选。
3. **API 层**：更新 `activityQuerySchema`，返回 `appliedFilters`
   元信息（方便前端展示）。错误情况下返回 400 + 明确错误码。
4. **前端**：`use-activities`
   Hook 改为构造服务端参数；列表组件在 flag 关闭时保留旧逻辑，flag 打开后使用服务端结果。
5. **监控**：借助 `performanceMonitor` 记录
   `MetricType.ACTIVITY_SEARCH_DURATION`（新增），脚本输出“Activity 搜索指标”。

## 6. 详细设计

### 6.1 数据库 & Prisma

- **字段**：

  ```sql
  ALTER TABLE activities
    ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
      setweight(to_tsvector('simple', coalesce(content, '')), 'A')
    ) STORED;
  ```

- **索引**：`CREATE INDEX idx_activities_search_vector ON activities USING GIN (search_vector);`

- **Prisma 层**：短期通过 `prisma.$queryRaw` 组合
  `WHERE search_vector @@ plainto_tsquery($1)`；若 Prisma 未来支持 `search`
  字段，可替换。

### 6.2 仓储层接口

```ts
export interface ListActivitiesParams {
  // ... existing fields
  searchTerm?: string | null
  tags?: string[] | null
  publishedFrom?: Date | null
  publishedTo?: Date | null
}

export interface ListActivitiesResult {
  // ... existing fields
  appliedFilters: {
    searchTerm?: string
    tags?: string[]
    publishedFrom?: string
    publishedTo?: string
  }
}
```

- 搜索与关注流不冲突，`searchTerm` 在 `following` 模式下同样生效。
- 若所有过滤条件为空则保持当前行为，避免性能回退。
- 添加保护：当搜索词长度 < 2 时返回 400（避免噪音）。

### 6.3 API 层修改

- `activityQuerySchema` 新增 `q`、`tags`、`dateFrom`、`dateTo`。
- 通过 feature flag 控制对外开放（Next.js
  `process.env.FEATURE_ACTIVITY_SERVER_SEARCH`）。
- 错误响应示例：
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_SEARCH_QUERY",
      "message": "搜索关键词至少需要 2 个字符"
    }
  }
  ```

### 6.4 前端改造

- `use-activities`：
  - 在 flag 打开时把搜索词、标签、日期区间写入 QueryString。
  - 将服务端返回的 `appliedFilters` 存入 Hook state，提供给 UI（便于高亮）。
- `ActivityList`：
  - 搜索框改为受控组件，触发时直接刷新 SWR。
  - 增加标签选择（从后端拉取推荐列表 / 手动输入）。
  - 显示“本页由服务器过滤”提示（提升透明度）。
- 回退策略：若服务器返回 400（参数错误）则在 toast 给出提示，并保持现有列表。

### 6.5 监控与验证

- 新增 `MetricType.ACTIVITY_SEARCH_DURATION`（记录耗时 ms、结果数量）。
- `scripts/collect-monitoring-data.sh` 输出 “Activity 搜索指标” 表，字段包含：
  - 总搜索次数
  - 空结果次数
  - 平均结果数量
  - P95 延迟
- Grafana / Supabase dashboard 加面板：
  - 近 24 小时搜索请求趋势
  - Top 10 搜索关键词
  - 错误率（4xx/5xx）

### 6.6 回滚策略

- feature flag 关闭 → 恢复客户端筛选；API 在 flag 关闭时忽略 `q`/`tags`。
- 数据库新增字段/索引不影响旧逻辑，可保留。
- 启动时对 `search_vector` 做一次 `REINDEX` 热身，防止冷启动抖动。

## 7. 测试计划

- **契约测试**：扩展 `tests/api/activities-pagination-contract.test.ts` 覆盖
  `q`, `tags`, `dateFrom/dateTo`。
- **仓储单测**：模拟 `searchTerm` + `hasImages` 组合，确保 SQL 正确。
- **前端组件测试**：`ActivityList` 交互（输入关键字 → 触发 SWR
  → 展示服务端过滤）。
- **性能基线**：利用 `scripts/load-test/activity-search.mjs`（待编写）模拟 1k
  rps，验证 P95 指标。

## 8. 风险与缓解

| 风险                    | 说明                      | 缓解                                                          |
| ----------------------- | ------------------------- | ------------------------------------------------------------- |
| PostgreSQL FTS 精度不足 | 简单模式可能遗漏中文分词  | 使用 `simple` + 自定义字典；必要时接入 pg_trgm 模糊匹配       |
| 索引更新开销            | 大量写操作可能拖慢 insert | 监控写入耗时；必要时改为异步刷新触发器                        |
| 客户端行为不一致        | 旧版本仍在使用客户端筛选  | 后端增加 `appliedFilters`，并保留兼容参数；移动端版本同步迭代 |
| 误用参数导致高负载      | 恶意长关键词              | 对 `q` 长度做上限（<= 64 字符），并结合速率限制               |

## 9. 时间线 & 资源估算

- Phase 1（1 周）：
  - DBA + 后端各 1 人日；测试 1 人日
- Phase 2（1 周）：
  - 前端 2 人日；后端 1 人日；QA 1 人日
- Phase 3（半周）：
  - 后端 0.5 人日；SRE 0.5 人日

## 10. 开放问题

1. 标签数据来源：目前 Activity 是否持久化标签？若尚未落地，需要与内容团队对齐格式与写入流程。
2. 移动端同步：是否存在原生客户端或第三方应用消费 Activity
   API？需要确认发布窗口。
3. 权限差异：是否需要根据用户角色调整搜索结果（例如运营人员可搜索全部，普通用户受限）？

---

> 本 RFC 经审批后进入实施阶段。实施完毕需更新《Phase6-系统设计.md》与监控计划中的“搜索指标”章节，并在 Phase6 汇总报告记录达成情况。
