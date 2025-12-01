# User Space Bugfix - Development Plan

## Overview
修复用户空间两个关键 bug：个人资料页社交链接显示问题和通知系统不完整问题（activity 点赞通知缺失及 follow 通知验证）

## Task Breakdown

### Task 1: 修复个人资料页社交链接显示
- **ID**: task-1
- **Description**: 修复个人资料页面只显示社交链接标签（"网站"、"邮箱"）而不显示实际值的问题。渲染实际的 URL 和邮箱地址，同时保持现有的隐私设置逻辑，确保用户可以看到实际可点击的链接而不仅仅是标签文本
- **File Scope**:
  - `app/profile/[userId]/page.tsx`
  - `components/profile/**` (如果涉及共享组件)
- **Dependencies**: None
- **Test Command**: `pnpm vitest tests/unit/profile-display.test.tsx --coverage --reporter=verbose`
- **Test Focus**:
  - 验证社交链接实际值（URL、邮箱）正确渲染
  - 验证隐私设置为 private 时链接不显示
  - 验证隐私设置为 public 时链接正确显示
  - 验证链接可点击性和格式正确性（mailto:、https://）

### Task 2: 实现 Activity 点赞通知
- **ID**: task-2
- **Description**: 扩展 `lib/interactions/likes.ts` 中的 `maybeNotifyLike` 函数，支持 `targetType="activity"` 的通知生成。当前只处理 `targetType="post"`，导致 activity feed 中的点赞不产生通知。需要添加 activity 类型的通知逻辑，包括正确的 target 信息用于 URL 构建
- **File Scope**:
  - `lib/interactions/likes.ts`
  - `tests/integration/notification-preferences.test.ts`
- **Dependencies**: None
- **Test Command**: `pnpm vitest tests/integration/notification-preferences.test.ts tests/unit/likes-service-coverage.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证 activity 点赞生成 LIKE 类型通知
  - 验证通知包含正确的 targetType、targetId、targetUrl
  - 验证不向自己发送通知（self-like 场景）
  - 验证通知偏好设置正确过滤通知
  - 验证与现有 post 点赞通知功能不冲突

### Task 3: 验证 Follow 通知功能并补充测试
- **ID**: task-3
- **Description**: 验证 `lib/interactions/follow.ts` 中的 follow 通知功能端到端工作正常，并补充完整的集成测试覆盖。虽然代码中已有 `notify(..., "FOLLOW")` 调用，但需要确认通知能正确生成、传递和接收，并添加全面的测试用例
- **File Scope**:
  - `lib/interactions/follow.ts`
  - `hooks/use-realtime-notifications.ts` (如需调整)
  - `tests/integration/notification-center.test.ts` (或新建 `tests/integration/follow-notifications.test.ts`)
- **Dependencies**: None
- **Test Command**: `pnpm vitest tests/integration/follow-notifications.test.ts tests/integration/notification-center.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证 follow 操作生成 FOLLOW 类型通知
  - 验证通知包含正确的 actorId、targetUserId、targetUrl
  - 验证通知通过 Realtime 正确传递
  - 验证 unfollow 不生成通知
  - 验证通知偏好设置可禁用 follow 通知
  - 验证与现有通知系统集成正常

## Acceptance Criteria
- [ ] 个人资料页正确显示社交链接实际值（URL、邮箱），不仅仅是标签
- [ ] 隐私设置为 private 时社交链接不显示，public 时显示
- [ ] Activity feed 中的点赞操作生成通知
- [ ] Activity 点赞通知包含正确的 targetType、targetId、targetUrl
- [ ] Follow 操作生成通知且通过 Realtime 正确传递
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过
- [ ] Code coverage ≥90%
- [ ] 所有通知类型（LIKE-activity、LIKE-post、FOLLOW）遵循统一的偏好设置逻辑
- [ ] 无回归问题（现有 post 点赞通知功能不受影响）

## Technical Notes
- **数据结构一致性**: 确保 activity 点赞通知的 target 结构与 post 点赞通知保持一致，便于前端 URL 构建
- **targetUrl 构建规则**:
  - Post: `/blog/${post.slug}`
  - Activity: `/feed?highlight=${activityId}` 或类似路径
- **测试隔离**: 三个任务的测试文件相互独立，可并行运行
- **Realtime 集成**: Follow 通知验证需要确认 Supabase Realtime publication 配置正确（`supabase/migrations/20251129000000_enable_notifications_realtime.sql`）
- **隐私逻辑**: Profile 页面的社交链接显示需要读取 `UserSettings.privacy` 或相关字段，确保逻辑与 `lib/permissions.ts` 一致
- **覆盖率策略**:
  - Task 1: 专注 UI 组件测试，使用 @testing-library/react
  - Task 2 & 3: 专注服务层和集成测试，使用 vitest + Prisma mock
- **向后兼容**: 所有修改必须保持现有 API 签名不变，不破坏现有调用方
