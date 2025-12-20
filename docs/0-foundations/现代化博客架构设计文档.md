### **现代化博客与社交动态平台 - 架构设计文档**

**版本**: 4.1 (Aligned with implementation) **日期**: 2025年8月21日 **编制**:
Gemini AI

---

### **1.0 项目愿景与核心原则**

#### **1.1 项目愿景**

为个人创作者打造一个集**专业内容发布**与**社区互动**于一体的现代化全栈平台。平台包含两大核心：一个由单一管理员控制的、高质量的**博客系统**；以及一个所有注册用户均可参与的、充满活力的**社交动态系统**。

#### **1.2 核心设计原则**

1.  **双重核心 (Dual
    Core)**: 明确区分**管理员博客管理**和**多用户社区互动**两套业务逻辑和权限体系。
2.  **灵活认证 (Flexible Authentication)**: 同时支持 OAuth
    (GitHub) 和 传统邮箱/密码两种认证方式。
3.  **精细化授权 (Granular Authorization)**: 通过**角色 (Role)** 和
    **状态 (Status)** 对用户进行精细化的权限控制。
4.  **模型通用化 (Polymorphic
    Models)**: 对评论、点赞等跨模块功能，采用通用的数据模型。
5.  **BaaS 驱动 (BaaS
    Driven)**: 以 Supabase 为核心，处理数据库、认证、存储等服务。

---

### **2.0 技术栈选型**

| 类别                | 技术选型                    | 建议版本 (截至 2025-08)      |
| :------------------ | :-------------------------- | :--------------------------- |
| **运行时环境**      | **Node.js**                 | `~22.x` (LTS)                |
| **包管理器**        | **pnpm**                    | `~9.12.x`                    |
| **核心语言**        | **TypeScript**              | `~5.9.x`                     |
| **全栈框架**        | **Next.js**                 | `~15.5.x` (稳定版)           |
| **核心库**          | **React**                   | `~19.1.x`                    |
| **后端平台 (BaaS)** | **Supabase (JS Libraries)** | `@supabase/supabase-js@~2.x` |
| **本地开发**        | **Docker + Supabase CLI**   | `Docker Compose + ~1.226.x`  |
| **ORM**             | **Prisma**                  | `~6.14.x`                    |
| **UI 基础**         | **Tailwind CSS**            | `~4.1.x`                     |
| **UI 组件**         | **shadcn/ui + magic ui**    | (N/A)\*                      |
| **动画库**          | **Framer Motion**           | `~12.23.x`                   |
| **测试**            | **Vitest**                  | `~2.x`                       |
|                     | **React Testing Library**   | `~15.0.x`                    |

_\*注：shadcn/ui 和 magic
ui 通过 CLI 将组件源码直接复制到项目中，其版本体现在执行 CLI 命令时获取的最新代码。_

---

### **3.0 数据架构与模型 (Prisma Schema)**

**文件**: `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
}

enum Role { USER, ADMIN }
enum UserStatus { ACTIVE, BANNED }

model User {
  id          String      @id @default(cuid())
  email       String      @unique
  name        String?
  avatarUrl   String?
  bio         String?     @db.Text
  socialLinks Json?
  role        Role        @default(USER)
  status      UserStatus  @default(ACTIVE)
  passwordHash String?

  posts     Post[]
  activities Activity[]
  series    Series[]
  comments  Comment[]
  likes     Like[]
  bookmarks Bookmark[]

  followers Follow[] @relation("Following")
  following Follow[] @relation("Follower")
}

model Post {
  id          String     @id @default(cuid())
  author      User       @relation(fields: [authorId], references: [id])
  authorId    String
  slug        String     @unique
  title       String
  content     String     @db.Text
  published   Boolean    @default(false)
  viewCount   Int        @default(0)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  isPinned     Boolean    @default(false)
  canonicalUrl String?

  series      Series?    @relation(fields: [seriesId], references: [id])
  seriesId    String?

  tags      PostTag[]
  comments  Comment[]
  likes     Like[]
  bookmarks Bookmark[]
}

model Series {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String?
  author      User     @relation(fields: [authorId], references: [id])
  authorId    String
  posts       Post[]
}

model Activity {
  id        String    @id @default(cuid())
  content   String    @db.Text
  author    User      @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime  @default(now())
  isPinned  Boolean   @default(false)

  comments  Comment[]
  likes     Like[]
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  createdAt DateTime @default(now())

  author    User     @relation(fields: [authorId], references: [id])
  authorId  String

  postId      String?
  activityId  String?
  post        Post?      @relation(fields: [postId], references: [id], onDelete: Cascade)
  activity    Activity?  @relation(fields: [activityId], references: [id], onDelete: Cascade)

  parent   Comment?  @relation("Replies", fields: [parentId], references: [id], onDelete: NoAction)
  parentId String?
  replies  Comment[] @relation("Replies")
}

model Like {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  author    User     @relation(fields: [authorId], references: [id])
  authorId  String

  postId      String?
  activityId  String?
  post        Post?      @relation(fields: [postId], references: [id], onDelete: Cascade)
  activity    Activity?  @relation(fields: [activityId], references: [id], onDelete: Cascade)

  @@unique([authorId, postId])
  @@unique([authorId, activityId])
}

model Tag {
  id    String    @id @default(cuid())
  name  String    @unique
  posts PostTag[]
}

model PostTag {
  post   Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  postId String
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  tagId  String
  @@id([postId, tagId])
}

model Bookmark {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  userId    String
  post      Post     @relation(fields: [postId], references: [id])
  postId    String
  @@unique([userId, postId])
}

model Follow {
  followerId  String
  followingId String
  follower    User       @relation("Follower", fields: [followerId], references: [id])
  following   User       @relation("Following", fields: [followingId], references: [id])

  @@id([followerId, followingId])
}
```

---

### **4.0 核心流程设计**

#### **4.1 认证与授权**

授权检查是所有 Server Action 的第一步，基于 `Role` 和 `Status` 进行。

- **互动权限 (评论、点赞、发动态、关注)**: 检查用户是否**已登录**且 `status` 为
  `ACTIVE`。
- **博客管理权限 (发文、删改)**: 检查用户是否**已登录**且 `role` 为 `ADMIN`。
- **用户管理权限 (改角色、改状态)**: 检查操作者是否**已登录**且 `role` 为
  `ADMIN`。

#### **4.2 文章归档实现**

- **数据基础**: `Post` 模型中的 `createdAt`
  字段是实现此功能的唯一数据来源，无需修改模型。
- **后端查询**: 需要创建一个 Server
  Action，使用 Prisma 的聚合（`groupBy`）功能，按年份和月份对 `Post`
  进行分组并计数。
- **前端路由**: 创建一个新的动态路由页面，如
  `app/archive/[year]/[month]/page.tsx`。

#### **4.3 动态交互实现建议**

前端应采用**乐观更新 (Optimistic UI)** 策略来实现流畅的点赞和评论体验。

---

### **5.0 项目实施规划**

#### **5.1 推荐项目目录结构**

```
/jikns_blog
├── /app                  # Next.js App Router 核心
├── /components           # 全局共享的 React 组件
├── /lib                  # 存放辅助函数 (如 Prisma Client 实例)
├── /prisma               # Prisma schema
├── /supabase             # 由 Supabase CLI 管理
│   ├── /migrations       # 数据库迁移的 SQL 文件
│   └── config.toml       # 本地 Supabase 环境配置
└── ...
```

#### **5.2 测试策略**

- **单元测试 (Unit Tests)**: 使用 Vitest 测试独立的 Server
  Actions 和业务逻辑函数。
- **组件测试 (Component Tests)**: 使用 Vitest 和 React Testing
  Library 测试复杂的交互式客户端组件。
- **端到端测试 (E2E
  Tests)**: （推荐）使用 Playwright 或 Cypress 测试核心用户流程。

#### **5.3 部署与运维 (DevOps)**

采用与数据库迁移深度集成的自动化 CI/CD 流程：

1.  **触发**: 代码合并到 `main` 分支，触发 Vercel 的部署流程。
2.  **数据库迁移**: 在 Vercel 构建开始前的 `pre-build`
    步骤中，执行脚本，将 Git 仓库中新的迁移安全地应用到生产数据库。
3.  **应用部署**: 数据库迁移成功后，Vercel 继续构建和部署 Next.js 应用。

#### **5.4 建议开发路线图**

- **第一阶段: 基建与用户系统**: 初始化技术栈，创建 v4.0 数据模型，完成双重认证系统。
- **第二阶段: 核心模块**:
  - **博客模块**: 实现文章 CRUD、文章系列、置顶、Canonical
    URL、文章归档、评论、点赞等功能。
  - **动态模块**: 实现动态的发布、置顶、评论、点赞、关注用户、双信息流（推荐/关注）等功能。
  - **用户管理模块**: 实现用户列表、角色修改、状态变更的后台管理界面。
- **第三阶段: 优化与完善**: 全面进行 SEO 优化，完善测试覆盖，打磨交互细节。
- **后续迭代规划**: **通知系统 (@提及)**、**邮件订阅 (Newsletter)**。

---

### **6.0 数据分析与可视化策略**

采用应用内数据 + Vercel Analytics 的分层策略。

---

### **7.0 架构分析与未来展望**

本章节旨在对当前 v4.0 架构进行客观评估，指出其优势、潜在瓶颈和未来的演进方向。

#### **7.1 可行性评估 (Feasibility)**

当前架构是**高度可行**的。我们选择的 **Next.js + Supabase + Prisma**
技术栈是成熟的现代化解决方案，足以支撑项目从零到一的全部功能。我们采用的通用化数据模型、Server
Actions 等设计模式，在保证功能的同时，也确保了良好的开发体验。

#### **7.2 潜在性能瓶颈 (Potential Performance Bottlenecks)**

为了追求开发效率，当前架构在以下几个方面存在未来可能需要优化的性能瓶颈：

1.  **动态信息流生成 (Feed
    Generation)**: 当前的“读时拉取”模式，在用户关注数增多后，查询性能会下降。这是所有社交应用需要面对的首要性能挑战。
2.  **实时计数 (Real-time
    Counting)**: 在列表页对每项内容都实时计算点赞/评论数（`_count`），在高并发下会给数据库带来压力。
3.  **缺少专用缓存层 (Lack of Caching
    Layer)**: 对热门文章、标签云等高频访问但低频变化的数据，反复查询数据库是种资源浪费。

#### **7.3 长期可升级性与优化路径 (Long-term Scalability & Optimization Paths)**

当前架构的优势在于，为上述所有瓶颈都预留了清晰、平滑的升级路径，我们无需在项目初期就进行过度设计。

1.  **信息流优化 ->
    “写时扇出”**: 当性能需要时，我们可以引入后台任务队列，将信息流的生成模式从“读时拉取”重构为“写时扇出”，将计算压力分摊到写操作上。
2.  **计数优化 -> “缓存计数器”**: 当计数查询成为瓶颈，我们可以为 `Post`
    等模型重新引入 `likesCount`
    等字段，在点赞/评论时通过事务更新此计数值，将读操作变为O(1)级别的查询。
3.  **缓存优化 -> “引入 Redis”**: 当数据库压力增大时，我们可以随时在架构中加入
    **Redis** 作为缓存层，用于缓存高频查询的结果，而无需改动核心业务逻辑。
4.  **服务迁移**: 当 Supabase 无法满足最终的性能需求时，由于其开放性（标准 Postgres），我们可以平滑地将数据迁移至更高规格的数据库平台，并逐步自研替换其认证、存储等服务。

**最终结论**: 当前架构是一个完美的起点，它让我们能快速前进，同时对未来的技术挑战和演进方向了然于胸。

---

### **8.0 本地开发环境配置**

#### **8.1 Supabase CLI 本地开发环境**

项目采用官方 **Supabase CLI**
作为主要的本地开发环境，提供与生产环境完全一致的功能和配置。

**服务架构**:

- **PostgreSQL 15**: 主数据库服务 (端口: 54322)
- **Supabase Auth (GoTrue)**: 认证服务 (端口: 9999)
- **PostgREST**: REST API 服务 (端口: 3000)
- **Supabase Storage**: 存储服务 (端口: 8000)
- **Kong Gateway**: API 网关和路由 (端口: 54321)
- **Supabase Studio**: Web 管理界面 (端口: 54323)

**核心优势**:

1. **官方支持**: Supabase CLI 是官方维护的本地开发解决方案
2. **功能完整**: 包含完整的 Supabase 功能栈，包括 Studio 管理界面
3. **配置同步**: 本地配置可直接同步到云端生产环境
4. **迁移管理**: 内置完善的数据库迁移版本控制系统
5. **零配置启动**: 一条命令启动完整的 Supabase 本地环境

#### **8.2 开发工作流**

**环境安装**:

```bash
# 安装 Supabase CLI
npm install -g @supabase/cli

# 验证安装
supabase --version
```

**项目初始化**:

```bash
# 初始化 Supabase 项目（首次）
supabase init

# 启动本地 Supabase 服务
supabase start
```

**开发流程**:

1. 启动 Supabase 本地服务 (`supabase start`)
2. 修改 Prisma Schema (`prisma/schema.prisma`)
3. 推送 Schema 到本地数据库 (`npx prisma db push`)
4. 生成迁移文件 (`supabase db diff -f migration_name`)
5. 启动 Next.js 开发服务器 (`pnpm dev`)

**环境管理**:

```bash
# 启动本地服务
supabase start

# 查看服务状态
supabase status

# 停止本地服务
supabase stop

# 重置本地环境（慎用）
supabase db reset
```
