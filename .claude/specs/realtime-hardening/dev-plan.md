# Realtime 订阅加固 - 开发计划

## 概述

加固 Supabase
Realtime 订阅机制的可靠性，通过重试、降级、网络感知等策略解决通知订阅中断、feed/comment 实时连接失败等问题。

## 任务分解

### Task 1: Realtime 基础设施模块

- **ID**: task-1
- **Description**: 构建可复用的 Realtime 基础设施层，包含指数退避重试调度器、会话预检和网络状态监听。创建
  `lib/realtime/retry.ts`
  实现可配置的重试策略（最大重试次数、初始延迟、退避因子），创建
  `lib/realtime/connection.ts`
  提供 Supabase 会话健康检查和浏览器网络状态监听 hook，创建统一导出的
  `lib/realtime/index.ts`。
- **File Scope**:
  - `lib/realtime/retry.ts` (新建)
  - `lib/realtime/connection.ts` (新建)
  - `lib/realtime/index.ts` (新建)
  - `tests/unit/lib/realtime/retry.test.ts` (新建)
  - `tests/unit/lib/realtime/connection.test.ts` (新建)
- **Dependencies**: 无
- **Test Command**:
  `pnpm test tests/unit/lib/realtime --coverage --coverage.include "lib/realtime/**/*.ts" --coverage.reporter=text --coverage.reporter=html`
- **Test Focus**:
  - 重试调度器：指数退避计算正确性、最大重试限制、中途取消
  - 会话预检：Supabase 客户端未初始化、会话过期、网络断开场景
  - 网络监听：online/offline 事件触发、重连逻辑、cleanup 正确性
  - 边界条件：并发调用、快速重连、内存泄漏

### Task 2: Activities 和 Comments Hook 加固

- **ID**: task-2
- **Description**: 重构 `use-realtime-activities.ts` 和
  `use-realtime-comments.ts`，集成 Task 1 的基础设施模块。使用 `useRef`
  稳定化回调引用避免 effect 无限循环，集成指数退避重试机制，实现 Realtime 失败时自动降级到轮询（保持现有 SWR 接口不变），添加网络状态感知（离线暂停订阅、上线恢复），增加详细的连接状态日志（开发环境）。
- **File Scope**:
  - `hooks/use-realtime-activities.ts` (修改)
  - `hooks/use-realtime-comments.ts` (修改)
  - `tests/hooks/use-realtime-activities.test.ts` (新建)
  - `tests/hooks/use-realtime-comments.test.ts` (新建)
- **Dependencies**: 依赖 task-1
- **Test Command**:
  `pnpm test tests/hooks/use-realtime-activities.test.ts tests/hooks/use-realtime-comments.test.ts --coverage --coverage.include "hooks/use-realtime-activities.ts" --coverage.include "hooks/use-realtime-comments.ts" --coverage.reporter=text --coverage.reporter=html`
- **Test Focus**:
  - 订阅生命周期：正常订阅、取消订阅、组件卸载 cleanup
  - 重试机制：首次失败重试、达到最大重试次数后降级轮询
  - 回调稳定性：props 变化不触发重连、回调引用保持稳定
  - 网络感知：离线时暂停订阅、上线后恢复、快速切换场景
  - 降级逻辑：Realtime → 轮询切换平滑、数据一致性、SWR mutate 正确触发

### Task 3: Likes Hook 加固

- **ID**: task-3
- **Description**: 重构 `use-realtime-likes.ts`，集成 Task
  1 的基础设施模块。该 hook 已具备回调稳定化（useRef），本任务在此基础上添加重试机制、轮询降级（Realtime 失败自动切换到定时 mutate）、网络状态感知（离线暂停、上线恢复）、连接状态日志（开发环境）。保持现有乐观更新逻辑不变。
- **File Scope**:
  - `hooks/use-realtime-likes.ts` (修改)
  - `tests/hooks/use-realtime-likes.test.ts` (新建)
- **Dependencies**: 依赖 task-1
- **Test Command**:
  `pnpm test tests/hooks/use-realtime-likes.test.ts --coverage --coverage.include "hooks/use-realtime-likes.ts" --coverage.reporter=text --coverage.reporter=html`
- **Test Focus**:
  - 订阅生命周期：正常订阅、取消订阅、快速多次切换
  - 重试与降级：重试失败后自动启用轮询、轮询频率合理（5-10秒）
  - 乐观更新兼容性：重试/降级不影响现有乐观更新逻辑
  - 网络感知：离线时停止订阅和轮询、上线恢复、网络抖动场景
  - 性能：并发多个 postId 订阅不互相干扰、内存占用合理

### Task 4: 现有 Notification 和 Dashboard Hook 统一重构

- **ID**: task-4
- **Description**: 将现有 `use-realtime-notifications.ts` 和
  `use-realtime-dashboard.ts` 迁移到 Task
  1 的共享基础设施模块。移除各自独立实现的重试/网络监听逻辑，统一使用
  `lib/realtime/retry.ts` 和
  `lib/realtime/connection.ts`。保持现有 API 接口不变（向后兼容），确保组件无需修改。更新相关单元测试和集成测试。
- **File Scope**:
  - `hooks/use-realtime-notifications.ts` (修改)
  - `hooks/use-realtime-dashboard.ts` (修改)
  - `tests/unit/realtime-notifications.test.ts` (修改)
  - `tests/integration/realtime-notifications.test.ts` (修改)
  - `tests/unit/use-realtime-dashboard.test.ts` (修改)
- **Dependencies**: 依赖 task-1
- **Test Command**:
  `pnpm test tests/unit/realtime-notifications.test.ts tests/integration/realtime-notifications.test.ts tests/unit/use-realtime-dashboard.test.ts --coverage --coverage.include "hooks/use-realtime-notifications.ts" --coverage.include "hooks/use-realtime-dashboard.ts" --coverage.reporter=text --coverage.reporter=html`
- **Test Focus**:
  - 向后兼容性：现有调用方式不变、返回值类型不变、行为一致
  - 功能完整性：notifications 的已读/未读更新、dashboard 的实时指标更新
  - 重构正确性：原有测试全部通过、新增共享模块集成测试
  - 降级策略：Realtime 失败时 notifications 降级到手动刷新、dashboard 降级到定时轮询
  - 性能对比：重构后连接建立时间、内存占用不劣化

## 验收标准

- [ ] 所有 Realtime
      hooks（activities、comments、likes、notifications、dashboard）均具备：重试机制、轮询降级、网络感知、会话预检
- [ ] 所有新建和修改的文件代码覆盖率 ≥
      90%（lines、branches、functions、statements）
- [ ] 现有组件无需修改（向后兼容），所有现有测试通过
- [ ] 开发环境下有清晰的连接状态日志（Realtime 连接、重试、降级、网络变化）
- [ ] 生产环境下无 console.log，仅在异常时记录结构化错误日志
- [ ] 所有 hooks 在网络离线时自动暂停订阅和轮询，上线后自动恢复
- [ ] 重试达到最大次数后，降级策略正确启用且数据保持一致性
- [ ] Vitest 单元测试和集成测试全部通过，执行时间不超过现有基线的 120%

## 技术要点

- **重试策略**：初始延迟 1s，退避因子 2，最大重试 3 次（总计约 15 秒）
- **轮询频率**：降级后每 5-10 秒一次 SWR mutate，避免过度请求
- **网络监听**：使用 `navigator.onLine` 和 `online/offline`
  事件，考虑 SSR 环境（服务端跳过）
- **会话预检**：订阅前检查 `supabase.auth.getSession()`，无会话则跳过订阅
- **回调稳定化**：所有 Realtime 回调用 `useRef`
  存储，避免 effect 依赖外部函数导致重连
- **TypeScript 严格模式**：所有新增代码通过 `pnpm type-check` 无错误
- **测试隔离**：每个测试独立 mock Supabase 客户端，避免状态污染
- **依赖约束**：不引入新的外部依赖，仅使用现有 `@supabase/supabase-js` 和 `swr`
