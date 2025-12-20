# 性能指标监控 - Development Plan

## Overview

为管理员监控仪表盘增强性能指标功能，支持数据持久化、自动采集和实时展示，包括时间序列分析和趋势对比。

## Task Breakdown

### Task 1: 持久化基建

- **ID**: task-1
- **Description**: 在 Prisma schema 添加 `PerformanceMetric` 模型和 `MetricType`
  枚举；创建数据库迁移；实现 `lib/metrics/persistence.ts`
  批量写入队列服务（阈值：100 条或 10 秒）；改造 `lib/performance-monitor.ts` 的
  `persistMetrics` 方法从内存存储切换到队列写入
- **File Scope**: `prisma/schema.prisma`, `lib/metrics/persistence.ts`,
  `lib/performance-monitor.ts`, `prisma/migrations/`,
  `tests/unit/metrics-persistence.test.ts`
- **Dependencies**: None
- **Test Command**:
  `pnpm db:generate && pnpm test tests/unit/metrics-persistence.test.ts --coverage`
- **Test Focus**:
  - 队列写入达到 100 条阈值时自动触发批量写入
  - 队列未满但超过 10 秒超时时触发批量写入
  - 数据库写入失败时回退到本地 `logs/metrics` 日志（仅开发环境）
  - `PerformanceMetric`
    模型字段验证（type、value、unit、timestamp、context、tags）
  - 索引正确创建（`type + timestamp DESC`、`tags`）
  - 队列清空和关闭时的边界情况处理

### Task 2: 采集接入

- **ID**: task-2
- **Description**: 在 `middleware.ts` 添加 `x-request-id` 和 `x-trace-start`
  header 生成逻辑；实现 `lib/api/response-wrapper.ts`
  响应包装工具，自动读取 header 计算 API 响应时间；在关键 API 路由（`app/api/admin/*`、`app/api/activities/*`、`app/api/comments/*`）集成性能记录；实现采样率开关（环境变量
  `METRICS_SAMPLE_RATE`）
- **File Scope**: `middleware.ts`, `lib/api/response-wrapper.ts`,
  `app/api/admin/*/route.ts`, `app/api/activities/route.ts`,
  `app/api/comments/route.ts`, `tests/integration/middleware.test.ts`,
  `tests/integration/metrics-collection.test.ts`
- **Dependencies**: depends on task-1
- **Test Command**:
  `pnpm test tests/integration/middleware.test.ts tests/integration/metrics-collection.test.ts --coverage`
- **Test Focus**:
  - middleware 为每个请求生成唯一 `x-request-id` (CUID 格式)
  - middleware 正确设置 `x-trace-start` 为当前时间戳
  - API 路由响应包装器正确计算耗时（单位：ms）
  - 采样率为 0.5 时约 50% 请求被记录（允许误差 ±10%）
  - 采样率为 0 时不记录任何指标
  - 关键路由（admin/activities/comments）成功记录性能指标到数据库

### Task 3: 查询与 API

- **ID**: task-3
- **Description**: 新增 `app/api/admin/metrics/route.ts` GET 路由；实现
  `lib/repos/metrics-repo.ts`
  查询层，支持时间范围过滤（startTime、endTime）、指标类型过滤、数据分桶聚合（60s/5m/1h）、对比窗口计算；定义
  `lib/dto/metrics.dto.ts` 响应 DTO；添加管理员权限校验（`requireAdmin` 中间件）
- **File Scope**: `app/api/admin/metrics/route.ts`, `lib/repos/metrics-repo.ts`,
  `lib/dto/metrics.dto.ts`, `lib/permissions.ts`,
  `tests/api/admin-metrics.test.ts`
- **Dependencies**: depends on task-1
- **Test Command**: `pnpm test tests/api/admin-metrics.test.ts --coverage`
- **Test Focus**:
  - 按时间范围查询（startTime=1h ago, endTime=now）返回正确数据
  - 按指标类型过滤（type=api_response）仅返回该类型指标
  - 数据分桶聚合（bucket=5m）正确计算每 5 分钟的平均值/P50/P95
  - 对比窗口（compareWindow=24h）返回前一时段的对比数据
  - 非管理员请求返回 403 Forbidden
  - 无数据时返回空数组和正确的统计信息（count=0）
  - 返回数据格式符合 `MetricsTimeseriesDTO` 定义

### Task 4: 前端展示

- **ID**: task-4
- **Description**: 重构
  `components/admin/monitoring-dashboard.tsx`，添加 recharts 折线图/面积图展示时间序列数据；新增
  `hooks/use-metrics-timeseries.ts` hook 调用 `/api/admin/metrics` 接口；新建
  `components/admin/metrics-chart.tsx`
  图表组件，支持时间范围选择器（近 1h/24h/7d/自定义）和趋势对比切换（P95 vs
  P50、当前 vs 对比窗口）
- **File Scope**: `components/admin/monitoring-dashboard.tsx`,
  `hooks/use-metrics-timeseries.ts`, `components/admin/metrics-chart.tsx`,
  `tests/unit/monitoring-dashboard.test.tsx`,
  `tests/unit/use-metrics-timeseries.test.ts`
- **Dependencies**: depends on task-3
- **Test Command**:
  `pnpm test tests/unit/monitoring-dashboard.test.tsx tests/unit/use-metrics-timeseries.test.ts --coverage`
- **Test Focus**:
  - 时间范围选择器切换（1h → 24h）触发新的数据查询
  - 自定义时间范围（开始时间 + 结束时间）正确传递给 API
  - 趋势对比开关切换时显示/隐藏对比窗口数据
  - P95 vs P50 指标切换时图表正确更新
  - `use-metrics-timeseries` hook 正确处理 loading/error/success 状态
  - 空数据时显示「暂无数据」状态
  - recharts 图表正确渲染时间序列（X 轴：时间，Y 轴：响应时间 ms）
  - 图表 tooltip 显示完整数据（时间、P50、P95、请求数）

## Acceptance Criteria

- [ ] `PerformanceMetric` 表成功创建，包含 `(type, timestamp DESC)` 和 `tags`
      索引
- [ ] 性能指标批量写入队列正常工作，阈值可配置（100 条或 10 秒）
- [ ] API 响应时间自动采集，支持采样率控制（环境变量 `METRICS_SAMPLE_RATE`）
- [ ] `/api/admin/metrics` 返回正确的时间序列数据，支持分桶聚合和对比窗口
- [ ] 监控仪表盘显示 recharts 图表，支持时间范围选择（1h/24h/7d/自定义）
- [ ] 趋势对比功能可用（当前 vs 对比窗口，P95 vs P50）
- [ ] 所有任务测试覆盖率 ≥90%（lines ≥ 90%, branches ≥ 85%）
- [ ] 代码通过 `pnpm quality:check`（lint + 类型检查 + 格式化）
- [ ] 数据库迁移可回滚且不破坏现有数据

## Technical Notes

### 数据模型设计

```prisma
model PerformanceMetric {
  id         String      @id @default(cuid())
  type       MetricType
  value      Float
  unit       String      // "ms" | "count" | "percent"
  timestamp  DateTime
  context    Json?       // { endpoint, method, userId, additionalData }
  tags       String[]
  requestId  String?
  userId     String?

  @@index([type, timestamp(sort: Desc)])
  @@index([tags])
}

enum MetricType {
  api_response
  db_query
  cache_hit
  external_api
}
```

### 持久化策略

- **批量写入阈列**：100 条或 10 秒触发 `prisma.performanceMetric.createMany`
- **失败回退**：仅开发环境写入 `logs/metrics/{date}.jsonl`（生产环境丢弃）
- **内存限制**：队列最大 200 条，超出时强制写入并清空

### 采集策略

- **Edge middleware**：仅生成 `x-request-id` 和 `x-trace-start`
  header，不执行数据库操作
- **后端路由**：读取 header 计算耗时，调用
  `recordApiResponse({ endpoint, method, duration, userId })`
- **采样率**：环境变量 `METRICS_SAMPLE_RATE=0.1` 表示 10% 请求被记录（默认 1.0）

### API 设计

**GET /api/admin/metrics**

- Query 参数：`type`, `startTime` (ISO 8601), `endTime`, `bucket` (60s | 5m |
  1h), `compareWindow` (1h | 24h)
- 响应格式：
  ```typescript
  {
    timeseries: Array<{ timestamp: string, avg: number, p50: number, p95: number, count: number }>,
    stats: { total: number, min: number, max: number, avg: number, p50: number, p95: number },
    comparison?: { ... } // 对比窗口统计
  }
  ```

### 前端展示

- **图表库**：复用项目已有的 recharts（版本见 `package.json`）
- **时间范围选择器**：使用 shadcn/ui `Select` 组件
- **自定义范围**：使用 `DateRangePicker`（需验证项目是否已有，否则使用原生
  `<input type="datetime-local">`）
- **数据刷新**：默认 30 秒轮询（`use-metrics-timeseries` hook 内置 SWR 配置）

### 约束条件

- **向后兼容性**：现有 `lib/performance-monitor.ts`
  的公共 API 不变，仅内部实现切换到队列
- **权限控制**：`/api/admin/metrics` 必须验证管理员角色（`requireAdmin` 中间件）
- **数据保留**：性能指标默认保留 30 天（建议后续添加定时清理任务，不在本计划范围内）
- **生产环境**：确保采样率合理（推荐 0.1-0.5），避免数据库写入压力过大
