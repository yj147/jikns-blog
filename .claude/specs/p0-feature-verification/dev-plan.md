# P0 功能验证 - Development Plan

## Overview
修复生产环境 P0 功能验证中发现的 5 个安全与健壮性 gap，包括 RLS 补丁、鉴权测试、降级机制、约束修复和私有访问强化。

## Task Breakdown

### Task 1: Email 表 RLS 补丁
- **ID**: task-1
- **Description**: 为 email_subscribers 和 email_queue 表添加 RLS 策略，撤销 anon 和 public 的直接访问权限，实施最小权限原则
- **File Scope**:
  - `supabase/migrations/` (新增补丁迁移文件)
  - `tests/integration/subscribe-api.test.ts`
- **Dependencies**: None
- **Test Command**: `pnpm test tests/integration/subscribe-api.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证 anon 用户无法直接读写 email 表
  - 验证 API 路由仍可正常订阅/退订
  - 验证 service_role 权限正常
  - 覆盖边界场景（SQL 注入尝试、批量操作拦截）

### Task 2: Cron 端点鉴权测试
- **ID**: task-2
- **Description**: 为 /api/cron/email-queue 补充鉴权失败分支测试，验证 x-cron-secret 机制的完整性，确保未授权调用被正确拦截
- **File Scope**:
  - `app/api/cron/email-queue/route.ts`
  - `tests/integration/cron-auth.test.ts` (新增)
- **Dependencies**: None
- **Test Command**: `pnpm test tests/integration/cron-auth.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证缺失 secret 返回 401
  - 验证错误 secret 返回 401
  - 验证正确 secret 正常执行
  - 验证 secret 不泄露到日志或响应中
  - 覆盖 timing attack 防护（固定时间比较）

### Task 3: 通知 Hook 轮询降级
- **ID**: task-3
- **Description**: 在 use-realtime-notifications hook 中实现 WebSocket 重试耗尽后的轮询降级机制，添加手动刷新开关，确保通知功能高可用
- **File Scope**:
  - `hooks/use-realtime-notifications.ts`
  - `lib/realtime/` (依赖模块)
  - `tests/unit/realtime-notifications.test.ts`
  - `tests/integration/realtime-notifications.test.ts`
- **Dependencies**: None
- **Test Command**: `pnpm test tests/unit/realtime-notifications.test.ts tests/integration/realtime-notifications.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证 WebSocket 连接失败后自动降级到轮询
  - 验证重试次数达到阈值后触发降级
  - 验证手动刷新开关行为
  - 验证轮询间隔配置生效
  - 模拟网络抖动与恢复场景
  - 验证状态同步正确性

### Task 4: Notifications 互斥约束修复
- **ID**: task-4
- **Description**: 修复 notifications 表的互斥约束为"恰好一个目标"（post_id/comment_id/user_id 有且仅有一个非空），同步 Prisma schema 和数据库迁移
- **File Scope**:
  - `supabase/migrations/20251202100001_data_integrity.sql` (新增)
  - `prisma/schema.prisma`
  - `tests/unit/schema-validation.test.ts`
- **Dependencies**: None
- **Test Command**: `pnpm test tests/unit/schema-validation.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证仅 post_id 非空可插入
  - 验证仅 comment_id 非空可插入
  - 验证仅 user_id 非空可插入
  - 验证多个字段非空被拒绝（CHECK 约束生效）
  - 验证全部字段为空被拒绝
  - 验证现有数据迁移兼容性

### Task 5: post-images 签名 URL 强制
- **ID**: task-5
- **Description**: 移除 post-images 桶的匿名直读策略，强制所有访问通过签名 URL，调整 signed-url 生成逻辑的桶白名单配置
- **File Scope**:
  - `supabase/migrations/20251202100002_post_images_private.sql` (新增)
  - `lib/storage/signed-url.ts`
  - `tests/integration/storage-private-access.test.ts` (新增)
- **Dependencies**: depends on task-4
- **Test Command**: `pnpm test tests/integration/storage-private-access.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证匿名用户无法直接读取 post-images 文件
  - 验证签名 URL 可正常访问
  - 验证签名 URL 过期后失效
  - 验证签名 URL 不可转移（IP/User-Agent 校验）
  - 验证其他桶（avatars）不受影响
  - 覆盖篡改签名参数的拒绝场景

## Acceptance Criteria
- [ ] 所有 email 表通过 API 访问，匿名用户无直接数据库权限
- [ ] Cron 端点拦截所有未授权请求，鉴权测试覆盖率 ≥90%
- [ ] 通知系统在 WebSocket 不可用时自动降级到轮询，保持功能可用
- [ ] Notifications 表约束防止数据不一致，所有边界场景有单测覆盖
- [ ] post-images 桶无匿名直读，所有访问经签名验证，安全测试覆盖率 ≥90%
- [ ] 所有单元测试通过（`pnpm test`）
- [ ] 所有集成测试通过（`pnpm test tests/integration`）
- [ ] 代码覆盖率 ≥90%（`pnpm test:coverage`）
- [ ] 质量检查通过（`pnpm quality:check`）

## Technical Notes
- **向后兼容性**：Task 4 和 Task 5 涉及数据库结构变更，需要验证现有数据迁移路径（可能需要 backfill 或分阶段部署）
- **RLS 策略优先级**：Task 1 需要确保 RLS 策略不影响 service_role 和内部 API，仅限制匿名直接访问
- **降级机制门槛**：Task 3 的轮询降级需要配置合理的重试阈值（建议 3 次）和轮询间隔（建议 10-30 秒），避免过度服务端压力
- **约束迁移风险**：Task 4 若现有数据违反新约束，迁移会失败，需先清理脏数据或设计临时豁免逻辑
- **签名 URL 性能**：Task 5 强制签名会增加 URL 生成开销，需要考虑客户端缓存策略（建议签名有效期 15-60 分钟）
- **依赖顺序**：Task 5 依赖 Task 4 的原因是 post-images 私有化后，notifications 中包含的图片链接需要先确保数据完整性，避免断链
- **测试环境隔离**：所有测试使用本地 Supabase 实例（`pnpm supabase:start`），不影响生产数据
- **Cron Secret 管理**：Task 2 需要确保 CRON_SECRET 环境变量在 CI/CD 和本地开发环境正确配置（参考 `.env.example`）
