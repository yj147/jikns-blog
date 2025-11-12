# 项目概览

## 项目目的

现代化个人博客与社交动态平台 - 集专业内容发布与社区互动于一体的全栈平台

## 双重核心架构

1. **博客模块**: 单一管理员控制的专业博客系统
2. **动态模块**: 多用户参与的社交动态系统 (类似微博/朋友圈)

## 技术栈 (基于架构设计文档 v4.1)

### 核心技术

- **框架**: Next.js 15.5.0 (App Router)
- **语言**: TypeScript 5.9.2
- **前端**: React 19.1.1
- **包管理**: pnpm 9.12+ (强制要求)

### 后端基础设施 (BaaS 驱动)

- **数据库**: Supabase PostgreSQL 17 + Prisma 6.14.0 ORM
- **认证**: Supabase Auth (GitHub OAuth + 邮箱/密码双重认证)
- **存储**: Supabase Storage
- **本地开发**: Supabase CLI + Docker Compose

### UI/UX 技术栈

- **样式**: Tailwind CSS 4.1.x
- **UI 组件**: shadcn/ui + Radix UI
- **动画**: Framer Motion 12.23.x
- **图标**: Lucide React

### 测试 & 质量保证

- **单元测试**: Vitest 2.1.9 + React Testing Library
- **E2E 测试**: Playwright
- **代码质量**: ESLint + Prettier + TypeScript
- **Git Hooks**: Husky + lint-staged

## 关键设计原则

### 1. 双重核心 (Dual Core)

- 明确区分管理员博客管理和多用户社区互动的业务逻辑
- 不同的权限体系和数据流

### 2. 灵活认证 (Flexible Authentication)

- 支持 GitHub OAuth 和传统邮箱/密码两种方式
- 基于角色 (ADMIN/USER) 和状态 (ACTIVE/BANNED) 的精细化权限控制

### 3. 模型通用化 (Polymorphic Models)

- Comment 和 Like 模型支持 Post 和 Activity 的多态关联
- 通用的交互系统设计

### 4. BaaS 驱动架构

- 以 Supabase 为核心处理数据库、认证、存储等服务
- 本地开发优先使用 Supabase CLI

### 5. 本地开发优先原则

- 日常开发必须在 Supabase CLI 本地环境中进行
- 确保生产数据安全，获得无延迟的开发体验

## 用户角色系统

### 管理员 (ADMIN)

- 博客内容的唯一创作者和管理者
- 平台最高权限拥有者
- 拥有所有普通用户权限 + 内容管理权限

### 注册用户 (USER)

- 通过认证登录的普通用户
- 可浏览、评论、点赞博客和动态
- 可发布和管理自己的动态内容

### 访客 (未登录)

- 只能浏览公开内容
- 无法进行任何交互操作

## 项目当前状态

### ✅ 已完成

- Next.js + React 基础框架搭建
- shadcn/ui + Tailwind CSS UI 系统
- 基础页面结构 (首页、登录、博客、搜索等)
- 测试框架配置 (Vitest + Playwright)
- 代码质量工具链 (ESLint + Prettier + Husky)
- Supabase 本地开发环境配置
- Prisma ORM 数据模型定义

### 🔄 进行中 / 待实现

- 认证系统实现 (GitHub OAuth + 邮箱认证)
- 数据库迁移和种子数据
- 博客 CRUD 功能
- 社交动态功能
- 搜索系统
- 用户权限管理

## 开发环境配置

### 端口配置

- 开发服务器: 3999 (pnpm dev)
- Supabase API: 54321
- PostgreSQL: 54322

### 关键目录结构

```
/app/          # Next.js App Router 页面
/components/   # React 组件 (shadcn/ui)
/lib/          # 工具函数和配置
/prisma/       # 数据库 schema 和迁移
/supabase/     # Supabase 配置和迁移
/tests/        # 测试套件
/docs/         # 项目文档
/memory/       # 项目记忆文件
```

## 开发注意事项

### 强制规范

1. **必须使用 pnpm** 作为包管理器
2. **必须遵循 Supabase 本地开发工作流**
3. **Schema First 原则**: 数据库变更从 Prisma schema 开始
4. **代码质量**: 每次提交都会触发质量检查
5. **中文交流**: 所有交流使用简体中文，代码实体保持英文
