# 邮件订阅系统 - 开发计划

## 功能概述

实现完整的邮件订阅系统，支持用户订阅博客更新、通知邮件化、双重确认机制、退订管理和队列化异步发送。

## 技术决策摘要

### 数据模型
- **EmailSubscriber**: 订阅者表，包含邮件、用户关联、状态（待验证/已验证/已退订/弹回）、验证与退订 token、偏好设置
- **EmailQueue**: 邮件队列表，支持通知邮件化和新文章推送，记录发送状态、重试次数、错误日志
- **NotificationType 枚举扩展**: 新增 `NEW_POST` 类型

### 核心架构
- **通知管道集成**: `notify()` 返回前调用 `enqueueEmailNotification()` 写入队列
- **新文章批量推送**: 文章发布时写入一条 `NEW_POST` 类型队列记录，Cron 消费时批量发送
- **技术栈**: React Email + Resend API
- **目录结构**:
  - `emails/` - React Email 模板
  - `lib/services/resend.ts` - Resend 客户端封装
  - `lib/services/email-subscription.ts` - 订阅业务逻辑
  - `lib/services/email-queue.ts` - 队列处理逻辑
  - `app/api/subscribe/*` - 订阅 API 路由
  - `app/api/cron/email-queue/route.ts` - 队列消费端点

---

## 任务分解

### Task 1: 数据层更新
- **ID**: task-1
- **描述**: 更新 Prisma schema 添加 `EmailSubscriber` 和 `EmailQueue` 表，扩展 `NotificationType` 枚举，生成 Prisma client，更新相关 TypeScript 类型定义
- **文件范围**:
  - `prisma/schema.prisma`
  - `types/user-settings.ts`
  - `types/notification.ts`（如需扩展枚举）
- **依赖**: 无
- **测试命令**:
  ```bash
  pnpm db:generate && pnpm type-check && pnpm lint:check
  ```
- **测试焦点**:
  - Prisma client 成功生成且无类型错误
  - Schema 约束正确（unique、index、enum 值）
  - TypeScript 类型与 Prisma schema 对齐
  - 迁移文件生成（通过 `supabase db diff -f email_subscription_schema` 验证）

---

### Task 2: 订阅管理与邮件模板
- **ID**: task-2
- **描述**: 实现订阅、验证、退订 API 路由，创建 React Email 模板（验证邮件、通知邮件、新文章摘要），封装 Resend 客户端和订阅服务层
- **文件范围**:
  - `app/api/subscribe/route.ts`
  - `app/api/subscribe/verify/route.ts`
  - `app/api/subscribe/unsubscribe/route.ts`
  - `lib/services/email-subscription.ts`
  - `lib/services/resend.ts`
  - `emails/verification-email.tsx`
  - `emails/notification-email.tsx`
  - `emails/digest-email.tsx`
- **依赖**: task-1
- **测试命令**:
  ```bash
  pnpm test --coverage -- tests/unit/email-subscription.test.ts tests/integration/subscribe-api.test.ts --coverage.include='lib/services/email-subscription.ts' --coverage.include='lib/services/resend.ts'
  ```
- **测试焦点**:
  - 订阅流程：邮箱验证、token 生成、重复订阅处理
  - 验证流程：token 校验、过期检查、状态更新
  - 退订流程：token 校验、状态更新、幂等性
  - Resend API 调用错误处理（mock 失败场景）
  - 邮件模板渲染（快照测试）
  - 边界情况：无效邮箱、过期 token、已退订用户重新订阅

---

### Task 3: 通知邮件化集成
- **ID**: task-3
- **描述**: 修改现有通知系统集成邮件队列，在 `notify()` 中调用 `enqueueEmailNotification()`，更新互动模块（点赞/评论/关注）和文章发布逻辑，实现队列服务层
- **文件范围**:
  - `lib/services/notification.ts`
  - `lib/services/email-queue.ts`
  - `lib/interactions/likes.ts`
  - `lib/interactions/comments.ts`
  - `lib/interactions/bookmarks.ts`（如需）
  - `app/api/admin/posts/route.ts`（文章发布逻辑）
- **依赖**: task-1, task-2
- **测试命令**:
  ```bash
  pnpm test --coverage -- tests/unit/notification-service.test.ts tests/unit/email-queue.test.ts tests/integration/notification-email.test.ts --coverage.include='lib/services/notification.ts' --coverage.include='lib/services/email-queue.ts'
  ```
- **测试焦点**:
  - `notify()` 成功写入 EmailQueue 记录
  - 队列记录关联正确的 notificationId/postId
  - 文章发布时创建 NEW_POST 类型队列（一条记录对应所有订阅者）
  - 互动触发通知时同步创建邮件队列
  - 用户未订阅时不写入队列
  - 队列写入失败不影响核心通知逻辑（降级处理）
  - 覆盖率：notification.ts ≥ 90%, email-queue.ts ≥ 90%

---

### Task 4: 队列消费与前端组件
- **ID**: task-4
- **描述**: 实现 Cron 队列消费端点，创建订阅表单组件和订阅页面，添加退订确认页面，实现队列批量处理逻辑（NEW_POST 展开为多个收件人）
- **文件范围**:
  - `app/api/cron/email-queue/route.ts`
  - `lib/cron/email-queue.ts`
  - `components/subscribe-form.tsx`
  - `app/(public)/subscribe/page.tsx`
  - `app/(public)/subscribe/verify/page.tsx`
  - `app/(public)/unsubscribe/page.tsx`
- **依赖**: task-2, task-3
- **测试命令**:
  ```bash
  pnpm type-check && pnpm lint:check && pnpm test --coverage -- tests/unit/email-queue-cron.test.ts tests/components/subscribe-form.test.tsx --coverage.include='lib/cron/email-queue.ts' --coverage.include='components/subscribe-form.tsx'
  ```
- **测试焦点**:
  - Cron 端点鉴权（Vercel Cron Secret 或环境检查）
  - 队列消费逻辑：批量拉取 PENDING 记录、重试机制、状态更新
  - NEW_POST 类型展开：查询所有 VERIFIED 订阅者、批量发送、错误隔离
  - 发送失败重试：attempts 递增、lastError 记录、达到上限标记 FAILED
  - 前端组件：表单验证、加载状态、成功/错误提示
  - 页面路由：验证成功/失败、退订确认
  - 覆盖率：email-queue.ts ≥ 90%, subscribe-form.tsx ≥ 85%

---

## 验收标准

- [ ] 用户可通过前端表单订阅邮件，收到验证邮件
- [ ] 验证链接正确激活订阅状态
- [ ] 退订链接正确更新状态为 UNSUBSCRIBED
- [ ] 互动通知（点赞/评论/关注）触发邮件队列写入
- [ ] 新文章发布时创建批量邮件队列
- [ ] Cron 任务成功消费队列并发送邮件
- [ ] 发送失败场景正确重试和记录错误
- [ ] 所有单元测试通过，代码覆盖率 ≥ 90%
- [ ] TypeScript 类型检查无错误
- [ ] ESLint 和 Prettier 检查通过
- [ ] 本地 Supabase 环境迁移文件正确生成

---

## 技术要点

### 安全性
- 验证和退订 token 使用 SHA-256 哈希存储
- Token 过期时间默认 24 小时（可配置）
- Cron 端点必须验证 `CRON_SECRET` 或限制仅 Vercel 内部调用

### 性能优化
- 队列批量拉取限制（例如每次处理 50 条）
- NEW_POST 类型延迟发送（例如发布后 1 小时聚合）
- 使用 Resend 批量发送 API（如支持）

### 错误处理
- 邮件发送失败不阻塞核心通知流程
- 重试机制：最多 3 次，指数退避
- 弹回邮箱自动标记 BOUNCED 状态

### 可观测性
- 队列处理日志：发送成功/失败、耗时、错误详情
- 订阅来源追踪（source 字段）
- 邮件发送成功率监控（通过 EmailQueue 状态统计）

### 向后兼容
- 现有通知系统行为不变（仅增加邮件队列写入）
- 用户未订阅时不影响现有通知流程
- 数据库迁移可回滚（保留旧 schema 兼容性）
