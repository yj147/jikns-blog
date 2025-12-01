# Security Hardening - Development Plan

## Overview
完整的安全加固方案，包括 Supabase RLS 收紧、API 数据去敏、数据完整性约束、CSRF 强制执行与 Storage 私有化。

## Task Breakdown

### Task 1: Supabase RLS Hardening
- **ID**: task-1
- **Description**: 收紧 users/comments/likes/activity_tags/post_tags/tags/series 的 RLS 策略与 GRANT 权限，移除 anon 角色的不必要访问权限，确保匿名用户只能访问最小必要数据集
- **File Scope**: `supabase/migrations/*_rls_hardening.sql`
- **Dependencies**: None
- **Test Command**: `pnpm test tests/integration/users-rls.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证 anon 角色无法 SELECT users 表敏感字段
  - 验证 comments/likes 表要求认证后访问
  - 验证 activity_tags/post_tags 启用 RLS 且策略正确
  - 验证 RLS 策略正确拦截未授权请求

### Task 2: Activity API Desensitization
- **ID**: task-2
- **Description**: 从活动查询中移除 author.email 字段，更新类型定义与显示名回退逻辑（优先使用 name，不存在时回退至 `用户<id前6位>`），确保前端组件正确渲染
- **File Scope**: `app/api/activities/route.ts`, `lib/repos/activity-repo.ts`, `types/activity.ts`, `components/activity/activity-*.tsx`
- **Dependencies**: None
- **Test Command**: `pnpm test tests/api/activities-*.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证 API 响应 JSON 不包含 author.email 字段
  - 验证显示名逻辑正确回退（有 name 用 name，无 name 用 id 前 6 位）
  - 验证前端组件渲染正常无报错
  - 验证类型定义与运行时行为一致

### Task 3: Data Integrity Constraints
- **ID**: task-3
- **Description**: 为 `performance_metrics.userId` 添加外键约束关联 users(id)，为 notifications 表添加目标字段互斥 CHECK 约束（activityId/commentId/userId 三选一），同步更新 Prisma schema
- **File Scope**: `supabase/migrations/*_data_integrity.sql`, `prisma/schema.prisma`
- **Dependencies**: None
- **Test Command**: `pnpm type-check && pnpm db:generate && pnpm test tests/unit/schema-validation.test.ts --coverage`
- **Test Focus**:
  - 验证 performance_metrics 外键约束生效（插入不存在的 userId 失败）
  - 验证 notifications CHECK 约束拦截非法数据（多个目标字段同时非空）
  - 验证 Prisma schema 与数据库结构同步
  - 验证 Prisma 类型生成正确

### Task 4: CSRF Enforcement for Uploads
- **ID**: task-4
- **Description**: 删除 `/api/upload` 路由的 CSRF 豁免配置，在上传路由中强制校验 X-CSRF-Token header，确保所有上传操作必须携带有效 CSRF token
- **File Scope**: `lib/security/middleware.ts`, `app/api/upload/images/route.ts`, `app/actions/settings.ts`, `components/admin/post-form.tsx`
- **Dependencies**: None
- **Test Command**: `pnpm test tests/integration/avatar-upload.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证无 CSRF token 的上传请求返回 403
  - 验证无效 CSRF token 的上传请求被拒绝
  - 验证有效 CSRF token 的上传请求成功
  - 验证旧有上传流程（头像/博客图片）不受影响

### Task 5: Post-Images Privatization & Signed URLs
- **ID**: task-5
- **Description**: 将 `post-images` bucket 改为私有访问，扩展签名工具支持多 bucket（activity-images/avatars/post-images），更新上传与图片访问逻辑使用签名 URL
- **File Scope**: `supabase/migrations/*_post_images_private.sql`, `lib/storage/signed-url.ts`, `lib/actions/upload.ts`, `app/api/posts/route.ts`, `components/blog/blog-post-card.tsx`
- **Dependencies**: task-4
- **Test Command**: `pnpm test tests/integration/storage-private-access.test.ts --coverage --reporter=verbose`
- **Test Focus**:
  - 验证未签名 URL 无法访问 post-images 图片（返回 403）
  - 验证签名 URL 可正常访问图片
  - 验证签名 URL 有时效性（过期后无法访问）
  - 验证上传流程完整（上传成功 → 生成签名 URL → 前端正常渲染）
  - 验证多 bucket 签名工具正确工作

## Acceptance Criteria
- [ ] Supabase RLS 策略收紧，anon 角色权限最小化，敏感表启用 RLS
- [ ] Activity API 不再暴露 author.email，显示名回退逻辑正确（name 或 `用户<id前6位>`）
- [ ] performance_metrics 外键约束与 notifications 互斥约束生效，Prisma schema 同步
- [ ] 上传 API 强制 CSRF 校验，无 token 或无效 token 请求被拦截
- [ ] post-images bucket 私有化，所有图片访问通过签名 URL，旧有 bucket 不受影响
- [ ] All unit and integration tests pass
- [ ] Code coverage ≥90%

## Technical Notes
- **RLS 收紧策略**: users 表撤销 anon SELECT 权限，comments/likes 要求 authenticated 角色，activity_tags/post_tags 启用 RLS 策略限制写入
- **API 去敏化**: 活动查询移除 `author.email` 字段选择与返回，显示名回退逻辑改为 `user.name ?? '用户' + user.id.substring(0, 6)`
- **数据完整性**: `performance_metrics` 添加 `FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE`，notifications 添加 `CHECK ((activityId IS NOT NULL)::int + (commentId IS NOT NULL)::int + (userId IS NOT NULL)::int = 1)`
- **CSRF 执行**: 从 `lib/security/middleware.ts` 的 `CSRF_EXEMPT_PATHS` 移除 `/api/upload`，上传路由必须校验 `X-CSRF-Token` header
- **Storage 私有化**: post-images bucket 的 RLS 改为 `CREATE POLICY "Private access" ON storage.objects FOR SELECT USING (false)`，签名工具扩展支持多 bucket 参数
- **向后兼容**: 现有 activity-images/avatars bucket 保持公开访问，仅 post-images 私有化；上传流程仅添加 CSRF 校验，不改变其他逻辑
- **测试覆盖**: 每个任务必须有对应的集成测试，覆盖正常路径与异常路径（权限拒绝、约束违反、token 缺失/过期等）
- **迁移顺序**: Task 1/2/3 可并行执行，Task 4 必须在 Task 5 之前完成（避免私有化后上传失败）
