# Feed 管理 - 开发计划

## 功能概述
后台提供可检索、批量操作、权限受控的动态 feed 管理界面，让管理员/作者能快速查阅并处理动态。

## 任务分解

### 任务 1: Feed API 实现
- **ID**: task-1
- **描述**: 在 `app/api/admin/feeds` 实现分页筛选列表、详情、批量删除/置顶/隐藏等 Prisma 操作，并补充权限校验
- **文件范围**: app/api/admin/feeds/**, lib/auth/**, prisma/schema.prisma, types/feed.ts
- **依赖**: 无
- **测试命令**: pnpm test tests/api/feed.test.ts --coverage
- **测试重点**:
  - Prisma 查询条件覆盖（用户/活动/时间/关键词组合）
  - 批量操作的事务性和原子性保证
  - 权限拒绝路径（未登录、非管理员、非作者本人）

### 任务 2: Feed UI 组件
- **ID**: task-2
- **描述**: 在 `app/(admin)/feeds` 实现数据表、筛选器、批量选择操作、详情面板与状态提示，复用服务端 API
- **文件范围**: app/(admin)/feeds/**, components/admin/feed-**, hooks/useFeedFilters.ts, styles/admin/feeds.css
- **依赖**: 依赖 task-1
- **测试命令**: pnpm test tests/ui/feed-admin.test.tsx --coverage
- **测试重点**:
  - 前端筛选交互（多条件组合、重置、实时反馈）
  - 批量操作行为（全选、部分选、确认弹窗）
  - 权限 UI 差异（管理员 vs 作者视图）
  - 错误/空态/加载态渲染

### 任务 3: 权限框架扩展
- **ID**: task-3
- **描述**: 扩展现有权限框架（中间件或 server actions）以识别管理员与作者身份，限制 API/页面访问
- **文件范围**: middleware.ts, lib/auth/permissions.ts, supabase/migrations/**
- **依赖**: 无
- **测试命令**: pnpm test tests/auth/permissions.test.ts --coverage
- **测试重点**:
  - 不同角色访问控制（管理员/作者/普通用户/游客）
  - 未登录/越权请求返回正确状态码（401/403）
  - 角色变更后权限立即生效
  - 作者只能操作自己的 feed

### 任务 4: 测试覆盖补充
- **ID**: task-4
- **描述**: 为 feed API 和 UI 补充 Vitest/Playwright 覆盖，包括批量操作与权限案例
- **文件范围**: tests/api/feed.test.ts, tests/ui/feed-admin.spec.ts, vitest.config.ts
- **依赖**: 依赖 task-1, task-2, task-3
- **测试命令**: pnpm test:all
- **测试重点**:
  - 分页筛选查询快照对比
  - 批量操作事务断言（部分失败回滚）
  - 权限拒绝场景完整覆盖
  - 端到端流程（登录 → 筛选 → 批量操作 → 验证结果）

## 验收标准
- [ ] 管理员可查看所有动态，作者仅查看自己的动态
- [ ] 支持按用户、活动类型、时间范围、关键词的多条件筛选
- [ ] 批量删除/置顶/隐藏操作原子性执行，失败时全部回滚
- [ ] 权限校验覆盖所有 API 端点和页面路由
- [ ] UI 交互流畅，错误提示清晰，空态/加载态友好
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥90%

## 技术要点
- **权限分层设计**: 中间件处理路由级拦截，server actions 处理操作级校验，前端隐藏无权限 UI
- **查询优化**: 使用 Prisma 的 `include` 预加载关联数据，避免 N+1 查询；分页使用游标而非 offset
- **批量操作事务**: 所有批量更新/删除必须包裹在 Prisma 事务中，确保原子性
- **前端状态管理**: 使用乐观 UI 提升体验，同时保留错误回退机制
- **测试策略**: API 层使用 Vitest 单元测试，UI 层结合 Testing Library，端到端流程补充 Playwright
- **安全约束**: 所有 feed 操作必须验证当前用户身份，防止横向越权
