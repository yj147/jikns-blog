# GitHub OAuth 配置指南

## 🎯 核心配置

### GitHub OAuth App 设置

在 GitHub Developer Settings 中配置：

```
Application name: 现代博客开发环境
Homepage URL: http://127.0.0.1:54321
Authorization callback URL: http://127.0.0.1:54321/auth/v1/callback
```

**重要**: 确保回调URL是
`/auth/v1/callback`，这是 Supabase 的标准 OAuth 回调端点。

### ✅ Supabase 配置已完成

已通过 CLI 配置文件自动设置：

- **Site URL**: `http://localhost:4000`
- **Additional Redirect URLs**: 支持多个开发端口
- **GitHub OAuth redirect_uri**: `http://127.0.0.1:54321/auth/v1/callback`

### 环境变量配置

`.env.local` 文件中的关键配置：

```env
# Supabase 网关端口 (固定)
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"

# GitHub OAuth (从 GitHub App 获取)
GITHUB_CLIENT_ID="Ov23liNOasus4iRqR1hk"
GITHUB_CLIENT_SECRET="112c6f502b1291bef07e7937439f58914f1092e2"
```

## 🔄 认证流程

### 用户操作流程

1. **用户访问**: `http://127.0.0.1:3999/login` (Cursor 随机端口)
2. **点击登录**: 触发 GitHub OAuth
3. **OAuth 回调**: GitHub → `http://127.0.0.1:54321/auth/v1/callback` (网关端口)
4. **登录完成**: 重定向回 `http://127.0.0.1:3999/` (原始端口)

### 技术实现要点

```typescript
// OAuth 回调 URL 生成 (固定网关端口)
const callbackUrl = "http://127.0.0.1:54321/auth/callback"

// 登录完成后重定向 URL (动态端口)
const returnTo = `${window.location.origin}/profile`
```

## ✅ 验证检查

### 1. 网关端口验证

```bash
curl http://127.0.0.1:54321/health
```

### 2. OAuth 回调 URL

- ✅ 固定端口: `http://127.0.0.1:54321/auth/v1/callback`
- ✅ GitHub App 配置一致
- ✅ Supabase 网关处理

### 3. 动态端口支持

- ✅ Next.js 可运行在任意端口
- ✅ 用户界面使用 `window.location.origin`
- ✅ OAuth 始终通过网关处理

## 🚨 常见问题解决

### 问题1: "Invalid redirect URI"

**原因**: GitHub OAuth App 回调URL 不匹配 **解决**: 确保 GitHub App 配置为
`http://127.0.0.1:54321/auth/v1/callback`

### 问题2: "Connection refused"

**原因**: Supabase 本地服务未启动 **解决**: 运行 `supabase start`（使用 Supabase
CLI，不是 docker-compose）

### 问题3: "504 request_timeout" 和 "context deadline exceeded"

**原因**: Docker 容器无法访问 GitHub API (https://api.github.com/user)
**可能原因**:

- WSL2 网络配置问题
- 防火墙或代理阻止连接
- DNS 解析问题

**解决方案**:

1. **确认网络连接**: `curl -I https://api.github.com/user`
2. **重启网络**: `wsl --shutdown` 然后重新启动 WSL
3. **使用云端 Supabase**: 考虑使用 Supabase 云服务代替本地开发
4. **检查代理设置**: 确保 Docker 容器可以访问外网

### 问题4: 登录后无法重定向

**原因**: returnTo 参数处理错误 **解决**: 检查 `/app/auth/callback/route.ts`
中的重定向逻辑

## 📝 配置文件总览

### 修改的文件

- `/lib/auth-utils.ts` - URL 生成逻辑
- `/components/auth/login-button.tsx` - OAuth 触发逻辑
- `/.env.local` - 环境变量配置

### 关键函数

- `getAuthCallbackUrl()` - 生成固定网关回调 URL
- `getCurrentSiteUrl()` - 获取当前站点 URL
- `handleGithubLogin()` - GitHub OAuth 登录处理
