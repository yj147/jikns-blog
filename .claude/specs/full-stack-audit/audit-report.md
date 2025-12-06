# 全栈生产代码审计报告

**审计日期**: 2025-12-04
**审计范围**: 全栈（前端 + 后端 + 数据层）
**审计维度**: 安全 + 代码质量 + 性能

---

## 执行摘要

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| CRITICAL | 5 | 必须立即修复的安全漏洞 |
| HIGH | 7 | 高优先级问题（安全风险或严重缺陷） |
| MEDIUM | 7 | 中等优先级（性能或技术债务） |
| LOW | 3 | 低优先级（代码风格或轻微问题） |

---

## CRITICAL - 必须立即修复

### C1. JWT 实现存在严重安全缺陷
**文件**: `lib/security/jwt-security.ts:21-29, 54-117`

**问题**:
- 自研 JWT 实现默认使用公开的硬编码密钥 `"access-secret-key"` / `"refresh-secret-key"`
- 签名算法使用 `sha256(secret || data)` 而非标准 HMAC
- 未校验 iss/aud/alg 字段

**影响**: 若环境变量缺失（常见），攻击者可伪造任意访问/刷新令牌直接通过 `withApiSecurity` 验证

**建议**:
- 改用标准库（jsonwebtoken / `crypto.createHmac`）
- 强制无密钥即启动失败
- 校验 iss/aud/alg

---

### C2. CSP 配置等同于禁用
**文件**: `lib/security.ts:22-35`

**问题**: CSP 全局包含 `'unsafe-inline'` 和 `'unsafe-eval'`，生产环境仍生效

**影响**: 等同于放弃 CSP，任何注入脚本可执行

**建议**:
- 区分开发/生产环境 CSP
- 移除 unsafe-inline/eval
- 改用 nonce 或 sha256 脚本白名单

---

### C3. 错误日志接口无鉴权可被滥用
**文件**: `app/api/logs/errors/route.ts:60-188`

**问题**:
- 匿名接口直接使用 `SUPABASE_SERVICE_ROLE_KEY` 创建 service-role 客户端
- 允许单次提交多达 50 条日志
- 未对 body 大小做限制
- `details` / `metadata` 字段未截断

**影响**: 攻击者可在无鉴权情况下写入任意大 payload，绕过 RLS 持续撑爆 error_logs 表或耗尽 Supabase 带宽

**建议**:
- 改为 anon key + RLS 受控存储
- 设置 body size limit
- 字段截断
- 更严格 rate limit

---

### C4. 评论接口泄露用户 PII
**文件**:
- `app/api/comments/route.ts` (GET 不要求登录)
- `lib/interactions/comments.ts` (author.select 包含 email、role)
- `lib/dto/comments.dto.ts` (CommentResponseDto 强制返回)
- `components/comments/comment-item.tsx` (无昵称时展示邮箱)

**问题**: 评论 API 查询时选择了 `email`、`role` 并返回给前端，前端在无昵称时直接展示邮箱

**影响**: 所有评论者邮箱可被批量爬取，违反隐私保护

**建议**:
- 移除 author.email/role 暴露
- 改为最小公开字段（id/name/avatar）
- 如需管理员视图，走受限端点

---

### C5. 用户搜索接口泄露用户 PII
**文件**:
- `lib/repos/search/users.ts` (主/降级路径都选择 email 与 role)
- `lib/repos/search/shared/types.ts` (SearchUserResult 包含 email)
- `components/search/search-result-card.tsx` (使用 data.email 作为名称回退)

**问题**: 用户搜索实现返回 email 与 role，前端展示邮箱

**影响**: 任何人通过 /search 获取所有用户邮箱/角色，直接泄露 PII

**建议**:
- 查询与返回结构遵守 RLS 公共列白名单（id/name/avatar/bio）
- 移除 email/role
- 新增受控管理员搜索接口（如需）

---

## HIGH - 高优先级

### H1. 速率限制信任伪造的 IP 头
**文件**:
- `app/api/auth/login/route.ts:26-33`
- `app/api/auth/register/route.ts:32-39`
- `lib/security/middleware.ts:454-470`
- `lib/security.ts:444-477`

**问题**: 直接信任 `x-forwarded-for` / `x-real-ip`，攻击者可伪造头每次换 IP 绕过限流

**影响**: 登录/注册限流失效，审计日志被污染

**建议**:
- 使用平台提供的真实 IP（如 NextRequest.ip 或受信任代理解析首个地址）
- 限流状态放入集中存储（Redis/Upstash）或 edge KV

---

### H2. RateLimiter 进程内 Map 无清理
**文件**: `lib/security.ts:444-514`

**问题**: 进程内 Map 无定时清理调用，长运行会无限增长且每实例独立

**影响**: 限流效果和内存安全均不可控

**建议**: 改为带 TTL 的外部存储或定时清理并限制容量

---

### H3. Realtime 降级逻辑有缺陷
**文件**: `hooks/use-realtime-activities.ts:86-102, 174-248`

**问题**:
- 断线时 `startPolling` 把 `isPollingFallback` 设为 true，但若未传 `pollFetcher` 直接返回
- 每个 Realtime 事件都会 `fetchFullActivity` 再查一次 DB

**影响**: 前端以为在降级轮询实际停止更新；热点流量下形成 N+1

**建议**:
- 无 pollFetcher 时避免进入轮询状态
- 使用 payload 自带数据或批量预取

---

### H4. 用户文章列表抓取全文内容
**文件**: `app/api/users/[userId]/posts/route.ts:21-112`

**问题**: 列表接口为每篇文章选取全文 `content` 仅为计算阅读时长

**影响**: 每页拉取大文本，放大 DB 负载和响应体

**建议**: 去掉 content 选择，用预存读时长字段或轻量摘要表

---

### H5. SecurityProvider 默认信任为 true
**文件**: `components/security/security-provider.tsx:101-110`

**问题**: `refreshSecurityState` 直接将 `sessionValid` / `csrfTokenValid` 设为 true，TODO 未实现实际校验

**影响**: 安全状态完全基于伪值，等于默认信任任何已登录用户且忽略 CSRF

**建议**: 实现真实会话/CSRF 验证或将默认值设为 false

---

### H6. Cron 接口缺失密钥时放行
**文件**:
- `app/api/cron/email-queue/route.ts:13-20`
- `app/api/cron/sync-view-counts/route.ts:20-28`

**问题**: `CRON_SECRET` 未配置时直接放行（`!cronSecret` 视为已授权）

**影响**: 任何人都可触发定时任务，能批量发送邮件或反复写数据库

**建议**: 缺失密钥即拒绝（401），统一使用 `Authorization: Bearer <secret>`

---

### H7. 登录接口直接返回 token
**文件**: `app/api/auth/login/route.ts:172-232`

**问题**: 将 `access_token` / `refresh_token` 直接放入 JSON 响应返回给前端，未加 HttpOnly/SameSite 保护

**影响**: 一旦前端有 XSS 或第三方页面发起登录请求，刷新令牌可被窃取并长期重放

**建议**: 只依赖 Supabase 设置的 HttpOnly Cookie，不再回传原始令牌

---

## MEDIUM - 中等优先级

### M1. CSRF/token 生成回退到 Math.random
**文件**: `lib/security.ts:92-104, 330-344`

**问题**: 缺少 `crypto` 时退回 Math.random，熵过低

**影响**: Edge 环境或意外 polyfill 时可被预测

**建议**: 服务端强制使用 `crypto.randomBytes`，不可用时直接失败

---

### M2. Origin 验证允许 localhost
**文件**: `lib/security.ts:383-420`

**问题**: `validateRequestOrigin` 允许默认 `http://localhost:3000` 和硬编码 `https://yourdomain.com`

**影响**: 若生产未正确设置 `NEXT_PUBLIC_SITE_URL`，任意 localhost 源都被接受

**建议**: 显式配置允许域，缺失时拒绝并告警

---

### M3. auto-save hook 状态不可观察
**文件**: `hooks/use-auto-save.ts:41-104`

**问题**: `isSaving` / `lastSavedAt` 存在 ref 中，组件不会因保存状态变化而重新渲染

**影响**: UI 永远看不到"保存中/已保存"状态

**建议**: 改用 `useState` 或回传事件回调

---

### M4. 活动图片桶公开可访问
**文件**: `supabase/migrations/20251122000000_create_activity_images_bucket.sql`

**问题**: `activity-images` 设为 public 且策略允许 `TO public SELECT`

**影响**: 若活动支持受限可见性，图像仍可被公开读取

**建议**: 改为私有桶 + 签名 URL

---

### M5. syncUserFromAuth 实现冲突
**文件**:
- `lib/auth.ts:294-337` (按 ADMIN_EMAIL 提升角色)
- `lib/auth/session.ts:569-639` (强制 role: "USER")

**问题**: 两处实现冲突，`fetchAuthenticatedUser` 触发的自愈路径会把管理员自动降级

**影响**: 权限漂移且无审计

**建议**: 合并为单一实现，自愈时也应用管理员白名单

---

### M6. 登出 Cookie 名称错误
**文件**: `app/api/auth/logout/route.ts:52-55`

**问题**: 手动清理的 Cookie 名称（`supabase-auth-token` 等）与 Supabase 实际名称不符

**影响**: 会话未失效，留下固定会话风险

**建议**: 修正 Cookie 名称，只读 Cookie 环境下显式报错

---

### M7. 中间件白名单缺少 /api/users
**文件**: `middleware.ts:31-77`

**问题**: 仅对 `/api/user` 和 `/api/admin` 做登录检查，缺少 `/api/users`

**影响**: `/api/users/**` 下新增路由容易漏掉认证

**建议**: 将 `/api/users` 纳入 authenticated 或在路由基类集中断言登录

---

## LOW - 低优先级

### L1. 中间件仅在 test 环境做角色校验
**文件**: `middleware.ts:201-238`

**问题**: 角色校验和封禁检查仅在 test 环境执行

**影响**: 若有遗漏的服务端组件/路由，Admin 页面可能对已登录非管理员开放

**建议**: 中间件对 `/admin` / `/api/admin` 默认强制角色为 ADMIN

---

### L2. 大型列表缺少虚拟化
**文件**: `components/feed/feed-list.tsx`, `components/activity/activity-list.tsx`

**问题**: 大量活动时逐条渲染，未做窗口化

**影响**: 高活跃度场景易触发长列表重排与主线程抖动

**建议**: 考虑 react-window 或更小批次加载

---

### L3. OAuth state 校验依赖 Supabase
**文件**: `app/auth/callback/route.ts:14-60`, `app/api/auth/github/route.ts`

**问题**: 未显式校验 `state`，仅依赖 Supabase 内建机制，重放保护是单机内存 `Set`

**影响**: 多实例部署下无法阻止跨实例重放

**建议**: 绑定 `state` 到客户端和回调时校验，授权码设置本地 TTL

---

## 修复优先级建议

### 立即修复（P0 - 本周内）
1. C1 - JWT 实现替换
2. C4/C5 - PII 泄露修复
3. C3 - 错误日志接口加鉴权
4. H6 - Cron 接口加密钥检查
5. H7 - 移除 token 直出

### 短期修复（P1 - 两周内）
1. C2 - CSP 配置
2. H1/H2 - 速率限制改进
3. H5 - SecurityProvider 实现
4. M5/M6 - 认证相关修复

### 中期改进（P2 - 一个月内）
1. H3/H4 - 性能优化
2. M1-M4 - 安全加固
3. M7 - 中间件完善

### 长期优化（P3）
1. L1-L3 - 低优先级改进
2. 依赖漏洞扫描（CI 集成）

---

## 附录：审计工具与方法

- **静态分析**: Codex CLI 代码扫描
- **模式匹配**: 安全反模式识别
- **架构审查**: 数据流与权限边界分析
- **配置审查**: 环境变量与默认值检查

---

*报告生成时间: 2025-12-04*
