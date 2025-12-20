# P0 安全修复 - 开发计划

## 概述

修复 JWT 签名漏洞、PII 泄露、日志与定时任务的鉴权缺失等 P0 级安全问题，确保系统核心安全边界完整。

## 任务分解

### Task 1: JWT 签名与验证加固

- **ID**: task-1
- **描述**: 重写 JWT 签名与验证逻辑，使用 HMAC-SHA256 替代不安全的 SHA256 哈希，移除默认密钥，强制环境变量配置，增加 alg/iss/aud/type 字段校验
- **文件范围**: `lib/security/jwt-security.ts`, `lib/security/*.test.ts`
- **依赖**: None
- **测试命令**: `pnpm test lib/security/jwt --coverage --reporter=verbose`
- **测试焦点**:
  - 缺失 JWT_SECRET 环境变量时拒绝签名/验证
  - 篡改签名后验证失败
  - alg/iss/aud 不匹配时拒绝
  - 过期 token 拒绝
  - 正常签名与验证流程

### Task 2: 评论后端 PII 剔除

- **ID**: task-2
- **描述**: 从评论相关后端 API、DTO 和类型定义中完全移除 email 和 role 字段，仅保留 id/name/avatarUrl
- **文件范围**: `lib/interactions/comments.ts`, `lib/dto/comments.dto.ts`,
  `types/comments.ts`, `app/api/comments/**`
- **依赖**: None
- **测试命令**:
  `pnpm test lib/interactions/comments --coverage --reporter=verbose && pnpm type-check`
- **测试焦点**:
  - 评论列表响应不含 email/role
  - 创建/更新评论返回数据符合新 DTO
  - 类型检查通过，无残留引用
  - 边界条件：用户无头像/名称时的 fallback

### Task 3: 前端 PII 清理

- **ID**: task-3
- **描述**: 更新评论组件与搜索结果卡片，移除对 email 的依赖，使用 "匿名用户" 作为缺失名称的 fallback，同步更新相关类型定义
- **文件范围**: `components/comments/comment-item.tsx`,
  `components/search/search-result-card.tsx`, `types/search.ts`
- **依赖**: task-2
- **测试命令**:
  `pnpm test components/comments --coverage --reporter=verbose && pnpm lint:check`
- **测试焦点**:
  - 评论项仅展示 name/avatarUrl
  - 搜索用户卡片无 email 显示
  - name 为 null/undefined 时显示"匿名用户"
  - UI 快照测试更新

### Task 4: 日志端点鉴权

- **ID**: task-4
- **描述**: 为 `/api/logs/errors`
  增加鉴权逻辑，要求 LOG_INGEST_SECRET 请求头或有效登录 session，移除匿名 service-role
  key 访问路径
- **文件范围**: `app/api/logs/errors/route.ts`, `tests/api/logs/**`
- **依赖**: None
- **测试命令**: `pnpm test tests/api/logs --coverage --reporter=verbose`
- **测试焦点**:
  - 无 secret 且未登录时返回 401
  - 错误 secret 返回 403
  - 正确 secret 或已登录时写入成功
  - 保持现有日志格式不变

### Task 5: Cron 路由密钥校验

- **ID**: task-5
- **描述**: 为所有 cron 端点强制 `Authorization: Bearer <CRON_SECRET>`
  校验，缺失或不匹配时拒绝请求
- **文件范围**: `app/api/cron/email-queue/route.ts`,
  `app/api/cron/sync-view-counts/route.ts`, `tests/api/cron/**`
- **依赖**: None
- **测试命令**: `pnpm test tests/api/cron --coverage --reporter=verbose`
- **测试焦点**:
  - 无 Authorization 头时返回 401
  - Bearer token 不匹配 CRON_SECRET 时返回 403
  - 正确 secret 时执行 cron 逻辑
  - 统一错误响应格式

## 验收标准

- [ ] JWT 签名改用 HMAC-SHA256，强制环境变量，校验 alg/iss/aud
- [ ] 评论与搜索的后端/前端完全不暴露 email/role
- [ ] 日志端点要求 secret 或登录校验
- [ ] Cron 端点统一使用 Bearer token 校验
- [ ] 所有单元测试通过
- [ ] 代码覆盖率 ≥ 90%
- [ ] `pnpm type-check` 与 `pnpm lint:check` 通过
- [ ] 无向后兼容性破坏（API 响应字段仅删除敏感字段）

## 技术说明

- **JWT 实现**: 使用 Node.js `crypto.createHmac('sha256', secret)` 替代
  `createHash`，添加标准 claims 校验（alg/iss/aud/exp）
- **PII 策略**: 公开接口仅返回
  `{ id, name, avatarUrl }`，前端使用"匿名用户"作为 name 的 fallback
- **鉴权模式**:
  - 日志端点：优先校验 `LOG_INGEST_SECRET` 请求头，次选 session
  - Cron 端点：仅接受 `Authorization: Bearer <CRON_SECRET>`
- **环境变量**: 需确保 `.env.example` 包含
  `JWT_SECRET`、`LOG_INGEST_SECRET`、`CRON_SECRET` 的说明
- **测试隔离**: 各任务测试相互独立，可并行执行
