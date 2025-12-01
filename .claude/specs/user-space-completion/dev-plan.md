# 用户空间补全 - 开发计划

## 功能概述

基于偏好与隐私配置的用户资料与通知管理闭环（写入、控制、反馈）一体化，包含个人资料管理、偏好设置和通知中心三大模块。

## 任务分解

### 任务 1: Schema 迁移与类型定义
- **ID**: T1
- **描述**: 扩展 User 表新增 location、phone、notificationPreferences (JSONB)、privacySettings (JSONB) 字段，默认值为空对象；扩展 Notification 表新增 type 枚举（LIKE/COMMENT/FOLLOW/SYSTEM）和可空外键（postId, commentId）；更新 Prisma schema 并生成迁移文件；同步更新 TypeScript 类型定义
- **文件范围**: prisma/schema.prisma, prisma/migrations/, types/database.ts, types/index.ts
- **依赖**: 无
- **测试命令**: `pnpm db:migrate && pnpm db:generate && pnpm test tests/unit/schema-validation.test.ts --coverage && pnpm type-check`
- **测试重点**: 迁移后数据模型完整性验证，默认值正确性，类型定义与 Prisma 模型一致性，JSONB 字段序列化/反序列化，枚举类型约束

### 任务 2: 通知生成前置拦截（Preferences Gate）
- **ID**: T2
- **描述**: 在点赞（toggleLike）、评论（createComment）、关注（follow）等业务层加入通知偏好判定逻辑；统一通知构建路径，在源头检查用户的 notificationPreferences 配置，当对应类型通知被关闭时直接拒绝生成通知记录；重构现有通知生成逻辑为统一的通知构建器
- **文件范围**: lib/notifications/builder.ts, lib/notifications/preferences.ts, lib/interactions/likes.ts, lib/interactions/comments.ts, app/api/*/route.ts（涉及通知生成的 API）
- **依赖**: 依赖 T1
- **测试命令**: `pnpm test tests/integration/notification-preferences.test.ts --coverage`
- **测试重点**: 通知偏好拦截生效验证（关闭后 DB 无对应记录），四种通知类型的拦截逻辑，偏好配置边界情况（null/空对象/部分关闭），集成测试包含 DB 断言验证通知记录数为 0

### 任务 3: 个人资料与设置 UI/API
- **ID**: T3
- **描述**: 构建个人资料编辑表单（头像、简介、所在地、社交链接）；构建隐私设置面板（动态可见性、邮箱公开）；构建通知偏好设置面板（四类通知开关）；实现对应的 API 路由用于持久化用户配置；表单校验与错误处理
- **文件范围**: app/(settings|profile)/**/*.tsx, components/profile/, components/settings/, app/api/user/profile/route.ts, app/api/user/preferences/route.ts, app/api/user/privacy/route.ts
- **依赖**: 依赖 T1
- **测试命令**: `pnpm test tests/integration/user-settings.test.ts --coverage`
- **测试重点**: 表单提交与数据持久化完整流程，字段校验逻辑（必填/格式/长度），失败场景处理（网络错误/验证失败），JSONB 字段更新的部分更新与全量覆盖，UI 组件渲染与交互

### 任务 4: 通知中心实现
- **ID**: T4
- **描述**: 构建通知中心 UI，支持四类通知（LIKE/COMMENT/FOLLOW/SYSTEM）的聚合展示；实现未读/已读状态切换；实现红点计数机制（未读通知数）；支持按类型过滤通知；实现批量标记已读功能；实现通知列表分页与懒加载
- **文件范围**: app/(notifications)/**/*.tsx, components/notifications/, lib/notifications/fetch.ts, lib/notifications/mutations.ts, app/api/notifications/route.ts, app/api/notifications/[id]/route.ts
- **依赖**: 依赖 T1, T2
- **测试命令**: `pnpm test tests/integration/notification-center.test.ts --coverage`
- **测试重点**: 四类通知正确聚合与展示，未读/已读状态切换的数据库一致性，红点计数准确性（含实时更新），类型过滤逻辑，批量操作的原子性，分页边界情况，空状态处理

## 验收标准
- [ ] User 表迁移成功，所有现有用户自动获得 notificationPreferences 和 privacySettings 默认值 {}
- [ ] Notification 表支持四种类型枚举，可空外键关联正常工作
- [ ] 通知生成源头拦截生效：关闭特定类型通知后，对应通知记录在数据库中数量为 0（需 DB 断言验证）
- [ ] Settings 页面三个设置面板（个人资料/隐私/通知偏好）可正常提交并持久化到数据库
- [ ] Notification Center 正确展示四类通知，支持过滤与批量操作
- [ ] 红点计数准确反映未读通知数量，标记已读后实时更新
- [ ] 所有单元测试通过
- [ ] 所有集成测试通过，包含数据库断言
- [ ] 代码覆盖率 ≥90%（lines ≥ 90%, branches ≥ 90%）
- [ ] TypeScript 类型检查通过，无 any 类型滥用
- [ ] 所有 API 路由包含适当的错误处理与权限校验

## 技术要点
- **Schema 设计**：User 表 JSONB 字段默认空对象 {} 避免 null 分支判断，简化业务逻辑
- **通知拦截机制**：在业务层源头（toggleLike/createComment/follow）判定偏好，而非在通知生成层过滤，确保零落库（不写入被拒绝的通知）
- **类型安全**：Notification 表使用可空 FK 配合 type 枚举，支持四类通知的统一存储与类型安全访问
- **偏好与隐私解耦**：notificationPreferences 和 privacySettings 分别独立管理，避免配置耦合
- **红点机制**：基于 Notification 表的 isRead 字段聚合计数，确保未读数准确性
- **测试策略**：集成测试必须包含 DB 断言，验证通知拦截的副作用（记录数为 0）；覆盖率门槛 ≥90% 确保分支逻辑完整测试
- **迁移安全**：使用 Prisma 迁移工具确保向后兼容，现有用户数据自动获得默认值
- **性能考虑**：通知列表支持分页与索引优化（type, userId, createdAt），避免全表扫描
