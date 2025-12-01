# 用户空间测试补充 - Development Plan

## Overview
为用户空间模块（个人资料、设置、通知）补充 E2E 和集成测试，覆盖数据一致性、异常路径、防御性编程等关键场景，确保生产级质量保障。

## Technical Constraints
- **测试框架**: Vitest (集成测试) + Playwright (E2E)
- **覆盖率目标**: 每个任务 ≥90%，项目整体 lines ≥85%, branches ≥70%
- **数据库**: Prisma + Supabase (本地环境通过 `pnpm supabase:start`)
- **认证**: Supabase Auth (测试需要 mock 或真实 session)
- **并行执行**: 所有任务独立，支持并行开发

## Task Breakdown

### Task 1: Profile↔Settings 数据一致性 E2E
- **ID**: task-1
- **Description**: 新增 Playwright E2E 场景，验证用户在设置页更新个人资料（昵称、简介、社交链接）后，资料页即时展示一致的数据，覆盖正常更新和网络延迟场景
- **File Scope**:
  - `tests/e2e/user-settings.spec.ts` (扩充现有用例)
  - `tests/e2e/profile-settings-sync.spec.ts` (新增专项场景)
- **Dependencies**: None
- **Test Command**: `pnpm test:e2e --grep "profile-settings-sync"`
- **Test Focus**:
  - 用户更新昵称/简介后跳转到资料页，验证展示一致
  - 更新社交链接后刷新资料页，验证 links 渲染正确
  - 模拟慢速网络，验证 loading 状态和最终一致性
  - 验证 toast 提示和错误回退

### Task 2: QuickStats + Profile Tabs 集成测试
- **ID**: task-2
- **Description**: 为 `lib/profile/stats.getQuickStats` 新增单元测试，为 Profile Tabs (posts/activities) 新增集成测试，覆盖空态、分页、错误重试场景
- **File Scope**:
  - `lib/profile/stats.ts` (新增单元测试)
  - `components/profile/profile-posts-tab.tsx` (新增集成测试)
  - `tests/unit/profile-stats.test.ts` (新增)
  - `tests/integration/profile-tabs.test.tsx` (新增)
- **Dependencies**: None
- **Test Command**: `pnpm test -- tests/unit/profile-stats.test.ts tests/integration/profile-tabs.test.tsx --coverage --coverage-reporter=text`
- **Test Focus**:
  - `getQuickStats` 计算逻辑：正确统计 posts/followers/following/likes
  - Profile Tabs 空态：无 posts 时展示友好提示
  - 分页加载：验证滚动加载更多、loading 状态
  - 错误重试：模拟 API 失败，验证错误提示和重试机制

### Task 3: 通知 API 防御用例
- **ID**: task-3
- **Description**: 扩充 `tests/integration/notification-center.test.ts`，新增防御性测试用例，覆盖非法参数（非法 type、超限 limit、空 ids）、越权标记、并发标记等场景
- **File Scope**:
  - `tests/integration/notification-center.test.ts` (扩充现有)
  - `app/api/notifications/route.ts` (验证错误处理)
- **Dependencies**: None
- **Test Command**: `pnpm test -- tests/integration/notification-center.test.ts --coverage --coverage-reporter=text`
- **Test Focus**:
  - 非法参数：type='invalid'、limit=1001、ids=[]，验证 400 响应
  - 越权标记：用户 A 尝试标记用户 B 的通知，验证 403
  - 并发标记：同时标记多个通知，验证幂等性
  - 边界条件：空结果、大量通知

### Task 4: Avatar/社交链接异常与管理员路径
- **ID**: task-4
- **Description**: 扩充 `tests/integration/avatar-upload.test.ts` 和 `tests/integration/social-links.test.ts`，新增上传失败、Supabase metadata 同步失败、管理员代他人更新等异常路径测试
- **File Scope**:
  - `tests/integration/avatar-upload.test.ts` (扩充)
  - `tests/integration/social-links.test.ts` (扩充)
  - `app/api/user/profile/route.ts` (验证错误处理)
- **Dependencies**: None
- **Test Command**: `pnpm test -- tests/integration/avatar-upload.test.ts tests/integration/social-links.test.ts --coverage --coverage-reporter=text`
- **Test Focus**:
  - Avatar 上传失败：模拟 Supabase Storage 错误，验证用户提示
  - Metadata 同步失败：模拟 Supabase Auth 更新失败，验证回滚
  - 管理员路径：管理员代普通用户更新资料，验证权限和审计日志
  - 社交链接验证：非法 URL、超长链接，验证错误提示

### Task 5: 通知列表过滤状态保持 E2E
- **ID**: task-5
- **Description**: 新增/扩充 `tests/e2e/notifications.spec.ts`，验证通知列表的过滤器切换（all/unread）、无限滚动、网络失败恢复等 E2E 场景
- **File Scope**:
  - `tests/e2e/notifications.spec.ts` (扩充现有)
  - `app/notifications/page.tsx` (验证 UI 交互)
- **Dependencies**: None
- **Test Command**: `pnpm test:e2e --grep "notifications"`
- **Test Focus**:
  - 过滤器切换：点击 all/unread，验证列表更新和 URL 状态保持
  - 无限滚动：滚动到底部，验证加载更多和 loading 状态
  - 网络失败恢复：模拟 API 失败，验证错误提示和重试按钮
  - 标记已读：批量标记后验证 UI 更新

## Parallel Execution Strategy
所有任务相互独立，可以并行执行：
- Task 1, 2, 4：不同模块（Profile/Settings/Avatar），无资源冲突
- Task 3, 5：通知模块的不同层（API vs UI），可分别开发

建议执行顺序：
1. **优先级 1（基础覆盖）**: Task 2, Task 3（补充单元/集成测试）
2. **优先级 2（E2E 验证）**: Task 1, Task 5（端到端场景）
3. **优先级 3（异常路径）**: Task 4（健壮性加固）

## Acceptance Criteria
- [ ] 所有 5 个任务的测试用例通过
- [ ] 每个任务的测试覆盖率 ≥90%
- [ ] 项目整体覆盖率：lines ≥85%, branches ≥70%
- [ ] Profile 模块覆盖：资料展示、编辑、一致性验证
- [ ] 通知模块覆盖：API 防御、UI 交互、过滤/分页
- [ ] Avatar/社交链接覆盖：上传失败、同步失败、管理员路径
- [ ] 所有 E2E 场景在 Playwright 中通过
- [ ] 无 flaky tests（运行 3 次稳定通过）

## Technical Notes
- **测试隔离**: 每个测试用例使用独立的测试数据库事务，避免数据污染
- **Mock 策略**: 集成测试 mock Supabase Client，E2E 使用真实本地 Supabase 实例
- **覆盖率工具**: Vitest 内置 `--coverage`，通过 `vitest.config.ts` 配置阈值
- **E2E 前置条件**: 运行 `pnpm supabase:start` 启动本地数据库和认证服务
- **并发限制**: Playwright 默认并发执行，注意测试数据隔离（使用不同用户账号）
- **关键依赖**:
  - `lib/profile/stats.ts`：统计计算逻辑
  - `lib/services/notification.ts`：通知业务服务
  - `app/api/user/profile/route.ts`：资料更新 API
  - `app/api/notifications/route.ts`：通知查询/标记 API
