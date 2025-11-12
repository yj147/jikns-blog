# 建议命令指南

这是 jikns_blog 项目的核心开发命令，基于项目的实际配置。

## 基础开发命令

### 包管理 (必须使用 pnpm)

```bash
pnpm install              # 安装依赖
```

### 开发服务器

```bash
pnpm dev                  # 启动开发服务器 (端口: 3999)
pnpm start                # 启动生产服务器
pnpm build                # 构建生产版本
```

### 代码质量

```bash
pnpm lint                 # ESLint 自动修复
pnpm lint:check          # ESLint 检查不自动修复
pnpm format              # Prettier 格式化
pnpm format:check        # Prettier 检查格式
pnpm type-check          # TypeScript 类型检查
```

### 数据库 (Prisma + Supabase)

```bash
# Supabase 本地环境
pnpm supabase:start      # 启动本地 Supabase 服务栈
pnpm supabase:stop       # 停止本地 Supabase 服务栈
supabase status          # 查看服务状态
supabase logs            # 查看服务日志

# Prisma ORM
pnpm db:generate         # 生成 Prisma 客户端
pnpm db:push            # 推送 schema 到数据库
pnpm db:migrate         # 创建数据库迁移
pnpm db:seed            # 运行数据库种子
```

### 测试套件 (Vitest + Playwright)

```bash
# 单元测试
pnpm test               # 运行所有测试
pnpm test:watch         # 监视模式运行测试
pnpm test:coverage      # 运行测试并生成覆盖率报告

# 专项测试
pnpm test:auth          # 认证相关测试
pnpm test:auth:tdd      # 认证 TDD 测试脚本
pnpm test:permissions   # 权限系统测试
pnpm test:security      # 安全相关测试
pnpm test:critical      # 关键核心测试

# E2E 测试 (Playwright)
pnpm test:e2e           # 端到端测试
pnpm test:e2e:ui        # 带 UI 的 E2E 测试
```

### 质量保证

```bash
pnpm quality:check      # 完整质量检查 (lint + type-check + format + test)
pnpm quality:fix        # 自动修复质量问题
pnpm security:audit     # 安全审计
pnpm security:check     # 完整安全检查
```

## 特殊开发工作流

### 任务完成后必须运行

每完成一个开发任务后，建议运行以下命令确保代码质量：

```bash
pnpm quality:check      # 完整质量验证
```

### 提交前准备

项目配置了 husky Git hooks，会自动运行：

- pre-commit: ESLint + Prettier 自动修复
- pre-push: 质量检查

### Supabase 本地开发工作流

```bash
# 1. 启动本地环境
pnpm supabase:start

# 2. 修改数据库 schema
# 编辑 prisma/schema.prisma

# 3. 推送变更到本地数据库
pnpm db:push

# 4. 生成迁移文件 (可选，用于版本控制)
supabase db diff -f "migration_description"

# 5. 停止本地环境 (开发结束时)
pnpm supabase:stop
```

## 系统工具

### Linux 系统命令

```bash
ls -la                  # 列出文件 (包含隐藏文件)
cd <directory>          # 切换目录
grep -r "pattern" .     # 递归搜索文本
find . -name "*.tsx"    # 查找文件
git status              # Git 状态
git branch              # 查看分支
```

### 项目特定工具

```bash
tsx scripts/<file>.ts   # 运行 TypeScript 脚本
```

## 开发环境要求

- **Node.js**: 22.x LTS
- **包管理器**: pnpm 9.12+ (必须)
- **Supabase CLI**: 最新版本 (全局安装)
- **数据库**: PostgreSQL 17 (通过 Supabase 本地实例)
