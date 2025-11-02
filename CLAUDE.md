# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

# 现代化个人博客项目 - Claude 工作指南

## 🚨 CRITICAL RULE - 强制语言规则

**必须始终使用中文回答问题和交流**

- 所有解释、说明、思考过程和回复必须使用简体中文
- 代码实体（变量名、函数名、类名）和技术术语保持英文不变
- 违反此规则视为严重错误，必须立即纠正

---

本文件为 Claude 在此现代化个人博客项目中高效、精准工作提供核心指导。在开始任何工作前，必须熟悉并严格遵守以下核心参考资料中定义的规范。

## 核心参考资料 (Core Reference Documents)

1. **《现代化博客项目架构设计.md》**: 定义了项目的技术栈、版本、数据模型和部署流程。**是所有技术实现的唯一蓝图。**
2. **《现代化博客需求文档.md》**: 定义了项目的功能范围、用户角色和具体需求。**是所有功能开发的唯一依据。**
3. **《项目实施路线指南.md》**: 提供了项目从零到一的宏观步骤和 TDD 等开发方法论。

## 第一部分：核心编程原则 (Guiding Principles)

这是我们合作的顶层思想，指导所有具体的行为。

### 1. 可读性优先 (Readability First)

始终牢记"代码是写给人看的，只是恰好机器可以执行"。清晰度高于一切。

### 2. DRY (Don't Repeat Yourself)

绝不复制代码片段。通过抽象（如函数、类、模块）来封装和复用通用逻辑。

### 3. 高内聚，低耦合 (High Cohesion, Low Coupling)

功能高度相关的代码应该放在一起（高内聚），而模块之间应尽量减少依赖（低耦合），以增强模块独立性和可维护性。

### 4. 避免过度工程化 (Avoid Over-Engineering)

- **核心思想**: 严格遵循已确立的需求范围，解决**当前**的问题，而不是为未来可能出现但尚未存在的问题设计复杂的解决方案。
- **架构设计**: 必须遵循已确立的以 Next.js +
  Supabase 为核心的全栈架构，避免引入不必要的微服务或独立的后端。
- **功能开发**: 严格围绕**单一作者/管理员**的核心前提进行开发。例如，在实现用户系统时，只需考虑管理员通过 GitHub
  OAuth 登录的场景，无需构建复杂的多用户注册和权限体系。

### 5. 本地开发优先原则 (Local Development First)

- **核心思想**: 将个人开发的效率和生产环境的稳健性结合起来。本地开发必须优先使用官方
  **Supabase CLI** 的本地实例。
- **实践要求**:
  - 日常开发必须在 Supabase
    CLI 本地环境中进行，以获得无网络延迟的流畅体验，并确保生产数据的绝对安全。
  - 使用 `supabase start`
    启动完整的本地 Supabase 服务栈，包括 PostgreSQL、Auth、REST
    API、Storage、Kong 网关和 Studio 管理界面。
  - 所有数据库结构变更，必须先在本地 Supabase 环境完成，然后通过
    `supabase db diff -f migration_name` 生成迁移文件进行版本控制。

## 第二部分：具体执行指令 (Actionable Instructions)

这是 Claude 在日常工作中需要严格遵守的具体操作指南。

### 1. 沟通与语言规范

- **默认语言**: 请默认使用**简体中文**进行所有交流、解释和思考过程的陈述。
- **代码与术语**: 所有代码实体（变量名、函数名、类名等）及技术术语（如 Supabase,
  Prisma, Vercel 等）**必须保持英文原文**。
- **注释规范**: 代码注释应使用中文。
- **行尾注释禁令**: 严格禁止在代码行末尾添加注释（如
  `code; // 注释`）。所有注释必须单独占行或作为头部注释。

### 2. 批判性反馈与破框思维

- **审慎分析**: 必须以审视和批判的眼光分析我的输入，主动识别与**核心参考资料**的冲突点。
- **坦率直言**: 需要明确、直接地指出我思考中的盲点，特别是当我的指令可能偏离既定技术栈（例如，建议使用 Jest 而非 Vitest）或引入过度工程化时。
- **严厉质询**: 当我提出的想法或方案明显不合理时，必须使用更直接的言辞进行反驳，例如："这个方案似乎与《需求文档》中'单一管理员'的前提不符，是否需要重新评估？"

### 3. 开发与调试策略

- **坚韧不拔的解决问题**: 当面对编译错误或逻辑不通时，绝不允许通过简化或伪造实现来"绕过"问题。
- **编译错误处理**: 必须修复所有编译错误，禁止通过简化代码或降级版本来规避问题。每个编译错误都必须从根本上解决，确保代码的完整性和正确性。
- **依赖冲突处理**: 解决版本冲突而非简单降级，保持项目的完整性和最新性。当遇到依赖冲突时，必须分析冲突原因，找到兼容方案或使用合适的解析策略，而不是简单地降级到旧版本。
- **探索有效替代方案**: 如果当前路径确实无法走通，应在**既定技术栈**的框架内探索另一个逻辑完整、功能健全的替代方案来解决问题。
- **禁止伪造实现**: 严禁使用占位符逻辑、虚假数据或不完整的函数来伪装功能已经实现。

### 4. 项目与代码维护

- **规范化测试文件管理**: 严禁为新功能在根目录或不相关位置创建孤立的测试文件。在添加测试时，必须将新的测试用例整合到
  `tests/` 目录下与被测模块最相关的现有 **Vitest** 测试套件中。
- **统一文档维护**: 严禁为每个独立任务创建新的总结文档。任务完成后，必须优先检查并更新项目中已有的相关文档（如
  `README.md`、`现代博客项目架构设计.md` 等）。

### 5. 工作流程记录与任务规划 (遵照执行)

- **会话日志总结**: 每个完整工作流程结束后，必须在 `memory/session/`
  目录下创建会话日志总结。
- **任务清单规划**: 每个工作流程结束后，必须在 `memory/task/`
  目录下创建或更新任务报告。
- **项目记忆维护**: 定期更新 `memory/task-status.md` 和
  `memory/technical-decisions.md`。

## 第三部分：项目架构与工作流强制规定

这是针对本项目特有的、必须严格遵守的指令。

### 1. 技术栈与版本强制规定

- 所有开发活动都**必须**严格遵守**《现代化博客项目架构设计.md》**中
  **3.0 技术栈选型**部分定义的库和版本。
- **包管理器**: 本项目**必须使用 pnpm**，严禁使用 npm 或 yarn。

### 2. 数据库与迁移工作流

- **Schema First**: 所有数据库表结构的变更，**必须**首先在
  `prisma/schema.prisma` 文件中进行定义。
- **迁移流程**: 必须遵循以下流程：
  1. 确保 Supabase CLI 本地服务运行中 (`supabase start`)。
  2. 在本地修改 `prisma/schema.prisma`。
  3. 运行 `npx prisma db push` 将变更应用到**本地 Supabase 数据库**。
  4. 运行 `supabase db diff -f "migration_description"`，生成一个 SQL
     **迁移文件**。
  5. 将新生成的迁移文件和代码一起**提交到 Git**。

### 3. 认证与授权逻辑

- **认证入口**: 管理员认证流程**必须**基于 **GitHub OAuth** 实现。
- **授权检查**: 所有需要管理员权限的 Server
  Action 或页面，**必须**在执行核心逻辑前，从数据库中查询当前登录用户的 `role`
  字段，并验证其是否为 `ADMIN`。

### 4. 目录结构与代码组织

- 所有新创建的文件，**必须**严格按照**《现代化博客项目架构设计.md》**中
  **6.1 推荐项目目录结构** 放置。
- 例如：数据库迁移文件必须在 `/supabase/migrations/`，全局共享组件在
  `/components/`，Next.js 页面在 `/app/`。

## 项目状态说明 (Project Status)

**当前状态**: 🚧 开发初期阶段 - 基础 UI 框架已搭建，核心功能待实现

**开发就绪度**: 🟡 开发中 (20/100) - Next.js + shadcn/ui 基础框架已就绪

### 已完成的基础功能

1. ✅ **前端框架**: Next.js 15.5.0 (App Router) + TypeScript 5.9.2
2. ✅ **UI 库**: React 19.1.1 + shadcn/ui 基础组件集成完成
3. ✅ **样式系统**: Tailwind CSS 4.1.12 + PostCSS 配置
4. ✅ **基础页面**: 首页、登录、注册、博客、搜索等页面结构
5. ✅ **组件架构**: 模块化组件结构，支持主题切换
6. ✅ **技术栈现代化**: 核心技术栈已升级至架构设计文档要求版本

### 待实现的核心功能

1. 🔄 **数据库**: Supabase + Prisma ORM 配置和数据模型
2. 🔄 **认证系统**: GitHub OAuth + 邮箱密码双重认证
3. 🔄 **测试框架**: Vitest + React Testing Library 测试套件
4. 🔄 **搜索功能**: 全文搜索、建议提示、过滤器实现
5. 🔄 **内容管理**: 博客文章的创建、编辑、发布功能

### 当前可用的开发命令

基于实际的 package.json 配置，以下是当前可用的命令：

#### 基础开发命令

```bash
# 安装依赖
pnpm install

# 安装 Supabase CLI (全局)
npm install -g @supabase/cli

# 启动本地 Supabase 服务栈
supabase start

# 启动开发服务器 (localhost:3000)
pnpm dev

# 停止本地 Supabase 服务栈
supabase stop

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# ESLint 代码检查
pnpm lint
```

#### 计划实现的命令 (待配置)

以下命令将在基础设施配置完成后可用：

```bash
# 数据库相关 (需要配置 Prisma)
pnpm db:generate       # 生成 Prisma 客户端
pnpm db:push           # 推送 schema 到数据库
pnpm db:migrate        # 生成迁移文件

# Supabase 相关命令 (已可用)
supabase status        # 查看服务状态
supabase logs          # 查看服务日志
supabase db reset      # 重置本地数据库

# 测试相关 (需要配置 Vitest)
pnpm test              # 运行测试
pnpm test:watch        # 监听模式运行测试
pnpm type-check        # TypeScript 类型检查
```

## 项目架构概览 (Architecture Overview)

### 核心技术栈 (当前已配置)

- **框架**: Next.js 15.5.0 (App Router) ✅
- **语言**: TypeScript 5.9.2 ✅
- **包管理**: pnpm (推荐)
- **样式**: Tailwind CSS 4.1.12 + PostCSS ✅
- **UI组件**: Radix UI + shadcn/ui ✅
- **动画**: Framer Motion 12.23.12 ✅
- **UI库**: React 19.1.1 ✅

### 计划技术栈 (待配置)

- **数据库**: Supabase PostgreSQL + Prisma 6.14.0 ORM
- **认证**: Supabase Auth (GitHub OAuth + 邮箱密码)
- **测试**: Vitest 2.1.9 + React Testing Library + Playwright
- **运行时**: Node.js 22.x LTS

### 数据模型核心 (计划设计的11个模型)

基于架构设计文档，计划实现以下数据模型：

- **User**: 用户表，支持双重认证，角色管理 (USER/ADMIN)，状态控制 (ACTIVE/BANNED)
- **Post**: 博客文章表，支持草稿/发布状态，SEO优化字段
- **Series**: 文章系列表，内容组织和分类
- **Activity**: 社交动态表，用户互动内容发布
- **Comment**: 通用评论系统，支持文章和动态的多态关联，嵌套回复
- **Like**: 通用点赞系统，支持文章和动态的多态关联
- **Tag**: 标签系统，内容分类和检索
- **PostTag**: 文章标签关联表 (多对多关系)
- **Bookmark**: 收藏功能，用户内容收藏
- **Follow**: 关注系统，社交网络构建

### 目录结构

**当前实际目录结构**:

```
/jikns_blog
├── /app/                 # ✅ Next.js App Router 页面
│   ├── admin/            # 管理员面板页面结构
│   ├── blog/             # 博客相关页面
│   ├── feed/             # 动态信息流页面
│   ├── login/            # 登录页面
│   ├── profile/          # 用户资料页面
│   ├── register/         # 注册页面
│   ├── search/           # 搜索功能页面
│   ├── settings/         # 设置页面
│   ├── globals.css       # 全局样式
│   ├── layout.tsx        # 根布局组件
│   └── page.tsx          # 首页组件
├── /components/          # ✅ React 组件
│   ├── ui/               # shadcn/ui 基础组件
│   ├── activity-card.tsx
│   ├── features-section.tsx
│   ├── hero-section.tsx
│   ├── navigation.tsx
│   └── ...               # 其他组件
├── /lib/                 # ✅ 工具函数
│   └── utils.ts          # 通用工具函数
├── /hooks/               # ✅ 自定义React hooks
├── /docs/                # ✅ 项目文档
├── /public/              # ✅ 静态资源
├── /styles/              # ✅ 样式文件
├── components.json       # shadcn/ui 配置
├── next.config.mjs       # Next.js 配置
├── postcss.config.mjs    # PostCSS 配置
├── tsconfig.json         # TypeScript 配置
├── package.json          # 项目依赖配置
├── pnpm-lock.yaml        # 依赖版本锁定
├── CLAUDE.md             # 本文件
└── README.md             # 项目说明文档
```

**待创建的目录结构** (基础设施配置完成后):

```
├── /prisma/              # 🔄 Prisma schema 和迁移
├── /supabase/            # 🔄 Supabase 配置
├── /tests/               # 🔄 测试套件
├── /memory/              # 🔄 项目记忆与会话记录
├── /scripts/             # 🔄 项目脚本工具
└── /types/               # 🔄 TypeScript 类型定义
```

### 关键开发原则

- **单一管理员**: 基于 GitHub OAuth 的单一作者/管理员模式
- **本地优先**: 开发时使用 Supabase CLI 本地实例
- **Schema First**: 所有数据库变更从 Prisma schema 开始
- **类型安全**: TypeScript + Prisma 提供端到端类型安全
- **双重核心**: 区分博客模块(管理员控制)和动态模块(多用户社交)
- **灵活认证**: 支持 GitHub OAuth 和邮箱/密码两种认证方式

## 关键注意事项 (Key Considerations)

### 开发流程提醒

1. **项目已就绪**: ✅ Phase 1 基础设施已完成，可立即开始核心功能开发
2. **强制使用 pnpm**: 所有依赖管理必须使用 pnpm 9.12.0，绝不使用 npm 或 yarn
3. **遵循架构文档**: 严格按照 `docs/现代博客项目架构设计.md`
   中的技术栈版本进行开发
4. **本地开发优先**: 必须使用 Supabase
   CLI 本地实例进行开发，避免直接操作生产数据
5. **环境变量配置**: 需要创建 `.env.local` 文件配置本地开发环境

### 数据模型关键点

- **用户角色**: USER/ADMIN 枚举，ADMIN 拥有博客管理权限
- **用户状态**: ACTIVE/BANNED 枚举，控制用户互动权限
- **双重认证**: 支持 GitHub OAuth 和传统邮箱密码
- **通用交互**: Comment 和 Like 模型支持 Post 和 Activity 的多态关联
- **社交功能**: Follow 关系、Activity 动态、双信息流(推荐/关注)

## 下一步开发计划

基于当前项目状态，建议按以下优先级进行开发：

### Phase 1: 基础设施配置

1. **配置 Supabase**: 设置本地 Supabase 实例和云端项目
2. **配置 Prisma**: 设置 ORM 和数据模型定义
3. **配置测试环境**: 设置 Vitest 和 React Testing Library
4. **环境变量配置**: 创建必要的环境变量文件

### Phase 2: 核心功能实现

1. **用户认证系统**: GitHub OAuth + 邮箱密码登录
2. **数据库迁移**: 实现 11 个核心数据模型
3. **基础 CRUD**: 博客文章的创建、编辑、发布功能
4. **用户界面优化**: 完善现有页面的交互逻辑

### Phase 3: 高级功能

1. **搜索系统**: 全文搜索和过滤功能
2. **社交功能**: 评论、点赞、关注系统
3. **内容管理**: 标签、分类、系列文章管理
4. **性能优化**: 缓存、图片优化、SEO 优化

### 首次开发设置流程

**当前可用步骤**:

1. `pnpm install` - 安装项目依赖
2. `npm install -g @supabase/cli` - 安装 Supabase CLI
3. `supabase init` - 初始化 Supabase 项目
4. `supabase start` - 启动本地 Supabase 环境
5. `pnpm dev` - 启动开发服务器

**后续配置步骤** (基础设施就绪后):

1. 设置 Prisma 数据库连接
2. 配置测试环境 (Vitest + React Testing Library)
3. 设置环境变量文件
4. 运行数据库迁移

## 开发环境要求

### 当前环境配置

- **Node.js**: 22.x LTS (推荐)
- **包管理器**: pnpm 9.12+ (必须)
- **Supabase CLI**: 最新版本 (全局安装)
- **开发工具**: 支持 TypeScript 的编辑器 (VS Code 推荐)

### 环境变量配置

创建 `.env.local` 文件 (基础设施配置完成后):

```env
# Supabase 本地连接 (supabase start 后获取)
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-local-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-local-service-role-key"

# 数据库连接 (本地 Supabase)
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# GitHub OAuth (从 GitHub App 获取)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

## 项目架构特色

### shadcn/ui 集成

项目已完整配置 shadcn/ui 组件库：

- **配置文件**: `components.json` - 使用 "new-york" 风格
- **组件路径**: `@/components/ui/` - 所有 UI 组件
- **主题支持**: 支持亮色/暗色主题切换
- **图标库**: 使用 Lucide React 图标

**添加新组件**:

```bash
# 安装特定组件 (基础设施配置完成后)
npx shadcn@latest add button
npx shadcn@latest add form
npx shadcn@latest add dialog
```

### Next.js App Router 架构

- **页面路由**: 基于文件系统的 App Router
- **布局系统**: 嵌套布局和共享 UI 状态
- **服务器组件**: 优先使用 RSC 提升性能
- **客户端组件**: 仅在需要交互时使用 'use client'

### TypeScript 配置要点

- **路径别名**: `@/*` 映射到项目根目录
- **严格模式**: 启用完整 TypeScript 严格检查
- **JSX**: 使用 Next.js 优化的 JSX 转换
