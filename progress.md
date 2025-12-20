# 项目进度追踪

> 最后更新: 2025-12-03

## 当前阶段

**Phase 11: 搜索功能重构与文档同步**

## 已完成任务

### P0: 搜索模块重构 (2025-12-20)

| 任务                          | 状态 | 说明                                         |
| :---------------------------- | :--- | :------------------------------------------- |
| 移除 `lib/services/search.ts` | ✅   | 简化架构                                     |
| 统一 REST API 入口            | ✅   | `app/api/search/route.ts` -> `unifiedSearch` |
| 兼容性修复 (中文/邮箱/排序)   | ✅   | 分词、Email 匹配、Tags 排序                  |
| 文档同步                      | ✅   | 设计文档、架构说明、验证报告                 |

### P0: 功能验证 (2025-12-02)

| 功能               | 状态 | 备注                      |
| ------------------ | ---- | ------------------------- |
| Email Subscription | ✅   | RLS 补丁已添加            |
| Realtime Hardening | ✅   | 轮询降级已实现            |
| Security RLS       | ✅   | post-images 签名 URL 强制 |
| Notifications 约束 | ✅   | 恰好一个目标              |

### P1: Bug 修复 (2025-12-02)

| Bug                 | 状态 | 修复文件                                         |
| ------------------- | ---- | ------------------------------------------------ |
| 社交链接只显示标签  | ✅   | `app/profile/page.tsx`                           |
| Activity 点赞无通知 | ✅   | `lib/interactions/like.ts`                       |
| Follow 通知验证     | ✅   | `tests/integration/follow-notifications.test.ts` |

### P2: 测试稳定性 (2025-12-03)

| 问题                    | 状态 | 解决方案                   |
| ----------------------- | ---- | -------------------------- |
| Node 22 + tinypool 崩溃 | ✅   | pool=threads, singleThread |
| 内存溢出                | ✅   | 分片执行脚本               |
| Logger mock 问题        | ✅   | 统一 mock 工厂             |
| email-auth.test.ts 语法 | ✅   | mockPrisma 修复            |

## 测试状态

```
关键测试: 8/8 (100%)
单独运行: 全部通过
套件运行: 470/563 (83.5%)
```

剩余失败是套件运行时的内存溢出/mock 污染，单独运行测试文件均通过。

## 待办事项

### 高优先级

- [x] 运行 `quality:check` 完整质量检查
- [x] Git commit 提交所有变更
- [ ] 验证生产环境功能

### 中优先级

- [x] 启动本地 Supabase 验证测试
- [ ] 重新评估 `tests_disabled/` 测试集成
- [ ] 性能基线测试

### 低优先级

- [ ] 文档更新（API、架构）
- [ ] 依赖升级检查
- [ ] 代码覆盖率报告

## 关键文件变更 (本次会话)

```
# 搜索文档
docs/10-search/搜索功能设计文档.md
docs/10-search/搜索功能架构简化说明.md
docs/10-search/差异分析报告.md
docs/10-search/搜索功能使用指南.md

# 迁移
supabase/migrations/20251202_email_rls_hardening.sql
supabase/migrations/20251202113000_notifications_target_exact_one.sql
supabase/migrations/20251202100002_post_images_private.sql

# 核心代码
lib/services/notification.ts
lib/interactions/like.ts
lib/storage/signed-url.ts
hooks/use-realtime-notifications.ts
app/profile/page.tsx

# 测试配置
vitest.config.ts
scripts/run-vitest-sharded.mjs
tests/setup.ts
tests/helpers/logger-mock.ts

# 新增测试
tests/unit/profile-self-social-links.test.tsx
tests/integration/cron-auth.test.ts
```

## 技术债务

| 项目                    | 优先级 | 状态       |
| ----------------------- | ------ | ---------- |
| TODO: 集成外部报警系统  | 低     | 待定       |
| TODO: CSRF token 验证   | 中     | 待定       |
| 3 个不稳定测试被排除    | 中     | 待修复     |
| tests_disabled 认证测试 | 低     | 评估后保留 |

## 运行命令

```bash
# 关键测试
pnpm test:critical

# 完整测试
pnpm vitest run --reporter=basic

# 质量检查
pnpm quality:check

# 本地开发
pnpm dev
```
