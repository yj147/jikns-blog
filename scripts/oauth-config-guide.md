# GitHub OAuth App 配置指南

## ⚠️ 关键修正

之前的分析有误，现在提供**正确的配置方案**。

## Supabase OAuth 工作原理

Supabase OAuth 使用**两阶段重定向**机制：

1. **第一阶段**: GitHub → Supabase
   - `redirect_uri`: Supabase 的回调端点
   - Supabase 处理授权码，建立会话

2. **第二阶段**: Supabase → Next.js 应用
   - `redirect_to`: 我们指定的最终重定向地址
   - Next.js 应用处理最终业务逻辑

## GitHub OAuth App 正确配置

### 必要设置

**Application name**: `jikns_blog` (或您的应用名称) **Homepage URL**:
`http://localhost:3000` **Authorization callback URL**:
`http://localhost:54321/auth/v1/callback`

### Client 凭据

- **Client ID**: `Ov23liNOasus4iRqR1hk` ✅ (已配置)
- **Client Secret**: `112c6f502b1291bef07e7937439f58914f1092e2` ✅ (已配置)

## 配置步骤

1. 访问
   [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/applications)

2. 找到您的 OAuth App (Client ID: `Ov23liNOasus4iRqR1hk`)

3. 点击 "Edit" 编辑应用

4. 修改 **Authorization callback URL** 为：

   ```
   http://localhost:54321/auth/v1/callback
   ```

5. 保存更改

## 验证配置

配置完成后，OAuth URL 应该类似：

```
https://github.com/login/oauth/authorize
  ?client_id=Ov23liNOasus4iRqR1hk
  &redirect_uri=http://localhost:54321/auth/v1/callback
  &redirect_to=http://localhost:3000/auth/callback
  &response_type=code
  &scope=user:email
  &state=...
```

## 测试流程

```bash
# 1. 启动 Supabase 服务
docker-compose up -d

# 2. 启动 Next.js 开发服务器
pnpm dev

# 3. 测试登录
# - 访问 http://localhost:3000/login
# - 点击 "使用 GitHub 登录"
# - 应该成功完成整个流程
```

## 常见问题

### Q: 为什么需要 Supabase 回调而不是直接回调到 Next.js？

A: Supabase 需要处理 OAuth 授权码交换会话的过程，这是其认证机制的核心部分。

### Q: redirect_to 参数的作用是什么？

A: 告诉 Supabase 在完成认证后，最终重定向到哪个应用地址。

### Q: 为什么不能跳过 Supabase 直接使用 GitHub OAuth？

A: 因为我们使用了 Supabase 的认证系统，包括用户管理、会话管理等功能。

## 配置检查清单

- [ ] GitHub OAuth App Authorization callback URL 设置为
      `http://localhost:54321/auth/v1/callback`
- [x] `.env.local` 中的 GitHub Client ID/Secret 正确
- [x] `NEXT_PUBLIC_SITE_URL` 设置为 `http://localhost:3000`
- [x] `NEXT_PUBLIC_SUPABASE_URL` 设置为 `http://localhost:54321`
- [ ] Docker Compose 服务正常运行
- [ ] Next.js 开发服务器运行在 3000 端口
