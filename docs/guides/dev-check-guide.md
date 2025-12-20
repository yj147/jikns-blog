# 开发环境健诊工具

## 概述

开发环境健诊脚本用于快速诊断和修复常见的开发环境配置问题，特别是 "Failed to
fetch" 类错误。

## 使用方法

```bash
# 运行环境检查
pnpm dev:check

# 或直接运行脚本
tsx scripts/dev-check.ts
```

## 检查项目

1. **环境变量检查**
   - 验证必要的环境变量是否配置
   - 检查 Supabase URL 格式是否正确

2. **Supabase 连接**
   - 测试 Supabase 服务可达性
   - 检测本地/远程服务状态

3. **数据库连接**
   - 验证 DATABASE_URL 配置
   - 测试数据库连接

4. **Node.js 版本**
   - 确保使用 Node.js 18 或更高版本

5. **包管理器**
   - 验证 pnpm 已安装

6. **依赖检查**
   - 确认 node_modules 存在
   - 检查关键依赖是否安装

7. **Prisma 配置**
   - 验证 schema 文件存在
   - 检查 Prisma Client 是否生成

8. **端口可用性**
   - 检查开发服务器端口（默认 3999）是否可用

9. **本地 Supabase 状态**
   - 如果使用本地 Supabase，检查服务是否运行

## 常见问题修复

### Supabase 本地服务未运行

```bash
# 启动本地 Supabase
pnpm supabase:start
```

### 缺少环境变量

创建或编辑 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
DIRECT_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

### Prisma Client 未生成

```bash
# 生成 Prisma Client
pnpm db:generate
```

### 依赖未安装

```bash
# 安装所有依赖
pnpm install
```

## 输出示例

成功时：

```
✅ 所有必要的环境变量已配置
✅ Supabase 连接正常
✅ 数据库连接正常
✅ Node.js 版本: v20.11.0
✅ 使用 pnpm 包管理器
✅ 所有关键依赖已安装
✅ Prisma 配置正常
✅ 端口 3999 可用
✅ 本地 Supabase 服务运行中

✨ 所有检查通过！开发环境配置正确。
可以运行 `pnpm dev` 启动开发服务器
```

失败时会显示具体的错误信息和修复建议。
