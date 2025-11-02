# Supabase CLI 本地开发环境使用指南

## 概述

本项目使用官方 **Supabase CLI**
搭建完整的本地 Supabase 开发环境，包含 PostgreSQL 数据库、认证服务、REST
API、存储服务、网关服务和管理界面。这确保了开发环境与生产环境的完全一致性，同时提供了最佳的本地开发体验。

## 服务架构

### 核心服务组件

| 服务                 | 端口  | 说明              |
| -------------------- | ----- | ----------------- |
| **PostgreSQL**       | 54322 | 主数据库服务      |
| **GoTrue Auth**      | 9999  | Supabase 认证服务 |
| **PostgREST**        | 3000  | REST API 自动生成 |
| **Supabase Storage** | 8000  | 文件存储服务      |
| **Kong Gateway**     | 54321 | API 网关和路由    |
| **Supabase Studio**  | 54323 | Web 管理界面      |

### 服务连接关系

```
Next.js App (localhost:3000)
    ↓
Kong Gateway (localhost:54321)
    ↓
┌─── Auth Service (port:9999)
├─── REST API (port:3000)
├─── Storage Service (port:8000)
└─── Studio Interface (port:54323)
         ↓
    PostgreSQL (port:54322)
```

## 快速开始

### 1. 环境要求

- **Node.js**: 22.x LTS (推荐 18.x 以上)
- **pnpm**: 9.12+
- **Supabase CLI**: 最新版本
- **Docker**: 20.10+ (Supabase CLI 内部使用)

### 2. 启动开发环境

```bash
# 克隆项目后，安装前端依赖
pnpm install

# 全局安装 Supabase CLI
npm install -g @supabase/cli

# 初始化 Supabase 项目（首次）
supabase init

# 启动本地 Supabase 服务栈
supabase start

# 推送 Prisma Schema 到本地数据库
npx prisma db push

# 启动 Next.js 开发服务器
pnpm dev
```

### 3. 验证服务状态

访问以下地址验证各服务是否正常运行：

- **Kong Gateway**: http://localhost:54321
- **REST API**: http://localhost:54321/rest/v1/
- **Auth Service**: http://localhost:54321/auth/v1/
- **Supabase Studio**: http://localhost:54323 (数据库管理界面)

## 开发工作流

### 日常开发流程

1. **启动服务**

   ```bash
   supabase start
   ```

2. **数据库变更流程**

   ```bash
   # 修改 prisma/schema.prisma
   # 推送变更到本地数据库
   npx prisma db push

   # 生成迁移文件
   supabase db diff -f "describe_your_changes"
   ```

3. **前端开发**

   ```bash
   # 启动热重载开发服务器
   pnpm dev
   ```

4. **结束开发**
   ```bash
   # 停止所有服务
   supabase stop
   ```

### 数据持久化

- **数据库数据**: Supabase CLI 自动通过 Docker Volume 持久化
- **配置文件**: `supabase/config.toml` - 项目配置文件
- **迁移文件**: `supabase/migrations/` - 数据库结构版本控制
- **种子文件**: `supabase/seed.sql` - 初始化数据

## 环境变量配置

### Supabase 配置

使用 `supabase start` 后，CLI 会自动输出本地服务的连接信息：

```bash
# 启动后会显示类似信息：
Started supabase local development setup.

         API URL: http://localhost:54321
     GraphQL URL: http://localhost:54321/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: your-jwt-secret
        anon key: your-anon-key
service_role key: your-service-role-key
```

### Next.js 环境变量

创建 `.env.local` 文件，使用 `supabase start` 显示的实际值：

```env
# Supabase 本地连接配置
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-start

# 数据库连接
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# GitHub OAuth (需要单独配置)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

## 常用命令参考

### Supabase CLI 操作

```bash
# 启动本地 Supabase 环境
supabase start

# 停止本地环境
supabase stop

# 查看服务状态
supabase status

# 查看所有服务日志
supabase logs

# 查看特定服务日志
supabase logs -f db

# 重置本地数据库（危险操作）
supabase db reset

# 进入数据库 CLI
supabase db shell

# 查看 Supabase CLI 版本
supabase --version
```

### 数据库操作

```bash
# 推送 Prisma Schema 到数据库
npx prisma db push

# 生成 Prisma 客户端
npx prisma generate

# 生成 Supabase 迁移文件
supabase db diff -f "migration_description"

# 应用迁移到本地数据库
supabase db push

# 查看当前数据库结构
npx prisma db pull
```

### 开发服务器

```bash
# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 运行类型检查
pnpm type-check

# 运行 ESLint
pnpm lint
```

## 故障排查

### 常见问题

#### 1. 服务启动失败

**现象**: `supabase start` 失败 **解决方案**:

```bash
# 检查端口占用
lsof -i :54321
lsof -i :54322

# 停止并重启
supabase stop
supabase start
```

#### 2. 数据库连接失败

**现象**: Prisma 无法连接数据库 **解决方案**:

```bash
# 检查 Supabase 服务状态
supabase status

# 查看数据库日志
supabase logs db

# 验证连接字符串
echo $DATABASE_URL
```

#### 3. 认证服务异常

**现象**: GitHub OAuth 登录失败 **解决方案**:

```bash
# 检查认证服务日志
supabase logs auth

# 查看认证服务状态
supabase status

# 验证 GitHub OAuth 配置
cat .env.local | grep GITHUB
```

#### 4. API 请求失败

**现象**: REST API 返回 404 或 500 **解决方案**:

```bash
# 检查 Kong 网关日志
supabase logs kong

# 检查 REST API 日志
supabase logs rest

# 验证 API 端点
curl http://localhost:54321/rest/v1/
```

### 完全重置环境

如果遇到无法解决的问题，可以完全重置本地环境：

```bash
# 停止 Supabase 服务
supabase stop

# 完全重置本地数据库和配置
supabase db reset

# 重新启动服务
supabase start

# 重新推送数据库 Schema
npx prisma db push
```

## 性能优化建议

### 性能优化

1. **Docker 资源配置** (Docker Desktop)
   - 推荐: 最少 4GB 内存，建议 8GB
   - CPU: 至少 2 核心，建议 4 核心

2. **Supabase CLI 优化**

   ```bash
   # 仅启动必需的服务（可选）
   supabase start --exclude storage,imgproxy
   ```

3. **数据持久化**
   - Supabase CLI 自动管理 Docker 卷优化

### 开发体验优化

1. **使用专用终端标签页**
   - 一个用于 `supabase logs -f`
   - 一个用于 `pnpm dev`
   - 一个用于数据库操作

2. **设置命令别名**
   ```bash
   # 添加到 ~/.bashrc 或 ~/.zshrc
   alias sps="supabase start"
   alias spt="supabase stop"
   alias spl="supabase logs -f"
   alias sps="supabase status"
   ```

## 安全注意事项

⚠️ **重要提醒**:

1. **本地开发专用**: Supabase CLI 本地环境仅用于开发，不可用于生产
2. **保护敏感信息**: 不要将 GitHub OAuth 密钥提交到版本控制
3. **定期更新 CLI**: 保持 Supabase CLI 为最新版本获得安全更新
4. **网络隔离**: 本地服务仅监听 localhost，不对外暴露
5. **数据备份**: 重要开发数据应定期备份

## 更多资源

- [Supabase CLI 官方文档](https://supabase.com/docs/guides/cli)
- [Supabase 本地开发指南](https://supabase.com/docs/guides/cli/local-development)
- [Supabase CLI GitHub 仓库](https://github.com/supabase/cli)
- [Prisma 数据库操作指南](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Next.js 环境变量配置](https://nextjs.org/docs/basic-features/environment-variables)
