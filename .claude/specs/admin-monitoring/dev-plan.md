# Admin Monitoring System Fix - Development Plan

## Overview
Fix the admin monitoring dashboard's zero-data issue by implementing full API metrics coverage through middleware injection, batch-wrapping all API routes, and introducing a hybrid memory+database data source for performance reports.

## Task Breakdown

### Task 1: Middleware Metrics Headers
- **ID**: task-1
- **Description**: Add metrics context headers (`x-metrics-sample`, `x-trace-start`, `x-request-id`) to all `/api/**` routes in middleware; exclude monitoring endpoints (`/api/admin/monitoring/**`, `/api/admin/metrics/**`) to prevent infinite loops
- **File Scope**: `middleware.ts`
- **Dependencies**: None
- **Test Command**: `pnpm vitest run tests/integration/middleware.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - Verify headers are injected for all `/api/**` routes
  - Confirm monitoring endpoints are excluded from injection
  - Validate header format and values (`x-request-id` is UUID, `x-trace-start` is timestamp)
  - Test sampling logic if probabilistic sampling is implemented

### Task 2: Batch Wrap API Routes
- **ID**: task-2
- **Description**: Enhance `withApiResponseMetrics` to read `x-metrics-sample` header from middleware; systematically wrap all 55 API route handlers in `app/api/**/route.ts` with the updated wrapper
- **File Scope**: `lib/api/response-wrapper.ts`, `app/api/**/route.ts` (all route files)
- **Dependencies**: task-1
- **Test Command**: `pnpm vitest run tests/api --coverage --reporter=verbose`
- **Test Focus**:
  - Verify wrapper reads headers correctly from request context
  - Confirm metrics are collected for all HTTP methods (GET, POST, PUT, DELETE, PATCH)
  - Test error scenarios (500, 404, 400) are logged with correct status codes
  - Validate that memory metrics array is populated after route execution
  - Spot-check 5-10 representative routes across different API modules

### Task 3: Hybrid Data Source
- **ID**: task-3
- **Description**: Implement DB aggregation queries in `lib/metrics/persistence.ts` to fetch historical metrics; rewrite `getPerformanceReport(hours)` in `lib/performance-monitor.ts` to merge in-memory recent data with DB historical data; ensure time-based deduplication and sorting
- **File Scope**: `lib/performance-monitor.ts`, `lib/metrics/persistence.ts`
- **Dependencies**: None
- **Test Command**: `pnpm vitest run tests/unit/performance-monitor.test.ts tests/unit/metrics-persistence.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - Test DB query returns correct aggregated metrics for given time range
  - Verify memory + DB merge produces deduplicated, chronologically sorted results
  - Test edge cases: empty DB, empty memory, overlapping data
  - Validate report structure matches existing API contract
  - Test performance with large datasets (100+ records)

### Task 4: Monitoring API & Dashboard
- **ID**: task-4
- **Description**: Update `/api/admin/monitoring/route.ts` to call the new hybrid `getPerformanceReport()`; update `components/admin/monitoring-dashboard.tsx` and `hooks/use-realtime-dashboard.ts` to consume the new data structure; ensure backwards compatibility if response format changed
- **File Scope**: `app/api/admin/monitoring/route.ts`, `components/admin/monitoring-dashboard.tsx`, `hooks/use-realtime-dashboard.ts`
- **Dependencies**: task-3
- **Test Command**: `pnpm vitest run tests/unit/monitoring-dashboard.test.tsx tests/api/admin-metrics.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - Verify API route returns hybrid report data
  - Test dashboard renders non-zero metrics after service restart
  - Validate real-time updates work with hybrid data source
  - Test error handling when DB query fails (graceful degradation to memory-only)
  - Confirm charts and visualizations display historical trends correctly

## Acceptance Criteria
- [ ] All 55 API routes are wrapped with `withApiResponseMetrics`
- [ ] Middleware injects metrics headers for all `/api/**` routes (excluding monitoring endpoints)
- [ ] `getPerformanceReport()` merges memory + DB data correctly
- [ ] Dashboard shows real non-zero data even after service restart
- [ ] Historical data is persisted in DB and visible in trend charts
- [ ] All unit tests pass with ≥90% code coverage
- [ ] Integration tests confirm end-to-end metrics flow (middleware → wrapper → DB → dashboard)

## Technical Notes
- **Sampling Strategy**: If implementing probabilistic sampling in middleware, use environment variable `METRICS_SAMPLE_RATE` (default: 1.0 for 100% sampling)
- **DB Schema**: Ensure `PerformanceMetric` table exists with indexes on `timestamp` and `route` fields for efficient queries
- **Memory Safety**: Keep in-memory array size bounded (e.g., max 1000 recent entries) to prevent memory leaks
- **Backwards Compatibility**: Maintain existing `getPerformanceReport()` API signature; do NOT break current monitoring API consumers
- **Error Handling**: If DB query fails in hybrid mode, gracefully fallback to memory-only data and log warning
- **Performance**: DB aggregation queries should complete within 200ms for 24-hour range; use pagination if needed for longer ranges
