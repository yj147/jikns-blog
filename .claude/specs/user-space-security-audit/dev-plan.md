# 用户空间模块安全审计与修复 - 开发计划

## 功能概述

修复用户空间模块的 5 个已识别安全漏洞与一致性问题，包括 RLS 策略收紧、关注列表隐私校验、存储桶权限重构、互动接口一致性保障及端到端测试覆盖，确保代码覆盖率 ≥90%。

## 任务分解

### 任务 1: 收紧 users 表 RLS 策略仅公开必要列
- **ID**: task-1
- **描述**: 修改 Supabase users 表的 RLS 策略，将公开访问范围从全字段缩减至必要列（id, displayName, avatarUrl, bio, createdAt），敏感字段（email, role, settings）仅自身和管理员可访问；创建新的数据库迁移文件并验证策略生效；更新文档说明字段可见性规则
- **文件范围**: supabase/migrations/**, docs/rls-policies.md
- **依赖**: 无
- **测试命令**: `pnpm test tests/integration/users-rls.test.ts --coverage --reporter=verbose && pnpm db:migrate --dry-run`
- **测试重点**: 匿名用户仅可访问公开列（断言敏感字段为 null），登录用户可访问自身完整数据，管理员可访问所有用户完整数据，RLS 策略在 service_role 绕过时不影响现有后端查询，迁移文件可逆性验证

### 任务 2: 关注列表隐私校验与访问控制
- **ID**: task-2
- **描述**: 在关注列表 API 路由（app/api/users/[userId]/follow-list/）增加隐私设置校验逻辑，根据用户 privacySettings.followListVisible 配置决定列表可见性（public/followers-only/private）；为 hooks/use-follow-list.ts 添加权限判定逻辑，在客户端优雅降级展示；补充单元测试覆盖三种隐私级别的访问场景
- **文件范围**: app/api/users/[userId]/follow-list/route.ts, hooks/use-follow-list.ts, lib/permissions/follow-permissions.ts, tests/integration/follow-list-privacy.test.ts
- **依赖**: 无
- **测试命令**: `pnpm test tests/integration/follow-list-privacy.test.ts --coverage --reporter=verbose`
- **测试重点**: public 级别任意用户可访问，followers-only 级别仅关注者和自身可访问，private 级别仅自身可访问，管理员始终可访问，未登录用户访问 private 列表返回 403，客户端钩子正确处理权限拒绝场景（显示占位内容），覆盖率 lines≥90%, branches≥90%

### 任务 3: 存储桶改私有与签名 URL 流程重构
- **ID**: task-3
- **描述**: 将 Supabase Storage 的 avatars 桶从 public 改为 private；修改 app/actions/settings.ts 的头像上传逻辑，使用 service_role 密钥上传；在所有头像读取场景（app/profile/**, components/ui/avatar.tsx）替换为 createSignedUrl 方法，设置 1 小时过期时间；创建 Storage RLS 策略迁移文件；补充集成测试验证签名 URL 的生成与访问权限
- **文件范围**: supabase/migrations/**, app/actions/settings.ts, app/profile/**/*.tsx, components/ui/avatar.tsx, lib/storage/signed-url.ts, tests/integration/storage-private-access.test.ts
- **依赖**: 无
- **测试命令**: `pnpm test tests/integration/storage-private-access.test.ts --coverage --reporter=verbose`
- **测试重点**: 直接访问私有桶 URL 返回 403，签名 URL 在有效期内可正常访问，签名 URL 过期后返回 401，上传功能使用 service_role 密钥正常工作，RLS 策略禁止匿名用户直接上传，头像组件正确处理签名 URL 加载失败场景，覆盖率 lines≥90%, branches≥90%

### 任务 4: 互动接口一致性保障（禁止自赞与删除内容点赞清理）
- **ID**: task-4
- **描述**: 在点赞 API（app/api/likes/route.ts）增加自我点赞拦截逻辑，当 userId === 内容作者 ID 时返回 400 错误；在活动删除逻辑（lib/repos/activity-repo.ts）中补充级联删除关联的 likes 记录，确保计数一致性；在 lib/permissions/activity-permissions.ts 中统一权限校验逻辑；补充单元测试覆盖自赞拦截、删除级联、计数一致性三个场景
- **文件范围**: app/api/likes/route.ts, lib/repos/activity-repo.ts, lib/permissions/activity-permissions.ts, tests/integration/likes-consistency.test.ts
- **依赖**: 无
- **测试命令**: `pnpm test tests/integration/likes-consistency.test.ts --coverage --reporter=verbose`
- **测试重点**: 自我点赞请求返回 400 并附带明确错误消息，删除活动时所有关联 likes 记录被清理（DB 断言 count=0），点赞计数与 DB 实际记录数一致，权限校验逻辑在所有互动接口（likes/comments）统一应用，边界情况覆盖（已删除内容的点赞、重复点赞），覆盖率 lines≥90%, branches≥90%

### 任务 5: 补充隐私场景端到端测试覆盖
- **ID**: task-5
- **描述**: 创建综合性的端到端测试套件，覆盖私密资料访问、关注列表隐私控制、媒体文件访问三大场景；使用 Playwright 模拟不同用户角色（匿名/普通用户/关注者/管理员）访问受保护资源；验证前端 UI 在权限拒绝时的降级展示；确保测试覆盖率达到 90% 以上
- **文件范围**: tests/e2e/user-privacy.spec.ts, tests/integration/privacy-scenarios.test.ts
- **依赖**: 依赖 task-2, task-3
- **测试命令**: `pnpm test:e2e --grep privacy && pnpm test tests/integration/privacy-scenarios.test.ts --coverage --reporter=verbose`
- **测试重点**: 匿名用户访问 private 资料页显示占位内容，非关注者访问 followers-only 关注列表被拒绝，签名 URL 过期后头像加载失败并显示默认头像，管理员可访问所有受限资源，前端权限判定逻辑与后端 RLS 策略一致，覆盖率 lines≥90%, branches≥90%

## 验收标准
- [ ] users 表 RLS 策略仅公开 id/displayName/avatarUrl/bio/createdAt 五个字段，敏感字段访问受保护
- [ ] 关注列表支持三级隐私控制（public/followers-only/private），权限校验在 API 和客户端双重生效
- [ ] avatars 存储桶改为私有，所有头像访问通过签名 URL，直接访问返回 403
- [ ] 点赞 API 拦截自我点赞请求，活动删除时级联清理关联 likes 记录
- [ ] 端到端测试覆盖所有隐私场景（私密资料/关注列表/媒体访问），前端 UI 正确处理权限拒绝
- [ ] 所有单元测试与集成测试通过
- [ ] 代码覆盖率 ≥90%（lines ≥ 90%, branches ≥ 90%）
- [ ] 迁移文件可逆，支持回滚到修改前状态
- [ ] 现有 API 签名保持不变，向后兼容所有调用方
- [ ] TypeScript 类型检查通过，无 any 类型滥用
- [ ] 错误消息清晰友好，权限拒绝场景返回明确的 HTTP 状态码（403/401）

## 技术要点
- **Linus 哲学遵循**：严格向后兼容，不破坏现有 API 签名；使用 Prisma service_role 保持现有查询路径不受 RLS 影响
- **RLS 策略收紧**：采用白名单模式，仅暴露必要列；敏感字段访问通过 auth.uid() 自检或 role 判定
- **签名 URL 机制**：1 小时过期时间平衡安全性与性能；客户端缓存签名 URL 减少重复生成
- **权限校验层次**：数据库层（RLS）+ API 层（路由校验）+ 客户端层（UI 降级），三层防护
- **级联删除一致性**：使用事务确保 activity 删除与 likes 清理的原子性，避免孤儿记录
- **测试策略**：集成测试必须包含 DB 断言验证副作用（记录数、计数一致性）；E2E 测试覆盖真实用户流程
- **覆盖率门槛**：lines≥90%, branches≥90%，高于仓库默认值（85%/70%），确保安全敏感代码的完整测试
- **迁移安全**：所有 RLS 与 Storage 策略变更通过迁移文件版本控制，支持 up/down 操作
- **性能考虑**：签名 URL 生成仅在必要时触发（懒加载）；RLS 策略使用索引优化（userId, role）
- **错误处理**：权限拒绝返回标准 HTTP 状态码（403/401）并附带 i18n 友好的错误消息
