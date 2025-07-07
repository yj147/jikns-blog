1 # CLAUDE.md
2
3 This file provides guidance to Claude when working with code in this repository.
4
5 ### 第一部分：核心编程原则 (Guiding Principles)
6 这是我们合作的顶层思想，指导所有具体的行为。
7 1. **可读性优先 (Readability First)**：始终牢记“代码是写给人看的，只是恰好机器可以执行”。清晰度高于一切。
8 2. **DRY (Don't Repeat Yourself)**：绝不复制代码片段。通过抽象（如函数、组件、模块）来封装和复用通用逻辑。
9 3. **高内聚，低耦合 (High Cohesion, Low Coupling)**：功能高度相关的代码应该放在一起（高内聚），而模块之间应尽量减少依赖（低耦合），以增强模块独立性和可维护性。
10
11 ### 第二部分：具体执行指令 (Actionable Instructions)
12 这是 Claude 在日常工作中需要严格遵守的具体操作指南。
13
14 #### 沟通与语言规范
15 - **默认语言**：请默认使用简体中文进行所有交流、解释和思考过程的陈述。
16 - **代码与术语**：所有代码实体（变量名、函数名、类名等）及技术术语（如库名、框架名、设计模式等）必须保持英文原文。
17 - **注释规范**：代码注释应使用中文，侧重于解释“为什么”这么做，而不是“是什么”。
18 - **行尾注释禁令 (End-of-Line Comment Prohibition)**：严格禁止在代码行末尾添加注释。所有注释必须单独占行或作为函数/类的头部文档。
19
20 #### 批判性思维与解决问题
21 - **审慎分析**：必须以审视和批判的眼光分析我的输入，主动识别潜在的问题、逻辑谬误或认知偏差。
22 - **坦率直言**：需要明确、直接地指出我思考中的盲点，并提供显著超越我当前思考框架的建议，以挑战我的预设。
23 - **坚韧不拔的解决问题 (Tenacious Problem-Solving)**：当面对构建错误、逻辑不通或多次尝试失败时，绝不允许通过简化或伪造实现来“绕过”问题。必须坚持对错误进行逐一分析、定位和修复。
24 - **禁止伪造实现 (No Fake Implementations)**：严禁使用占位符逻辑（如空的 `if` 块）、虚假数据或不完整的函数来伪装功能已经实现。所有交付的代码都必须是意图明确且具备真实逻辑的。
25
26 ## 常用命令
27
28 ### 开发与运行

启动本地开发服务器
yarn dev

构建生产版本
yarn build

启动生产服务器
yarn serve

运行代码风格检查和自动修复
yarn lint

1
2 ### 测试

测试评论功能脚本
yarn test:comments

测试 Supabase 连接
yarn test:supabase

测试 PostgreSQL 连接
yarn test:postgres

    1
    2 ## 项目架构概览
    3
    4 这是一个基于 **Next.js (App Router)** 和 **TypeScript** 的现代化博客项目。
    5
    6 ### 模块结构
    7 - **`app/`**: 核心应用目录，包含页面路由、API 路由和全局布局。
    8 - **`components/`**: 全局可复用的 React 组件。
    9 - **`data/`**: 内容源目录，存放博客文章 (`.mdx`)、作者信息和站点元数据。

10 - **`lib/`**: 通用库和辅助函数，如 Supabase 客户端实例和验证逻辑。
11 - **`public/`**: 静态资源目录。
12 - **`database/`**: 存放数据库初始化和迁移的 `.sql` 脚本。
13 - **`scripts/`**: Node.js 脚本，用于构建后处理、数据迁移等。
14
15 ### 技术栈
16 - **核心框架**: Next.js 15+ / React 18
17 - **语言**: TypeScript
18 - **UI**: Tailwind CSS, Headless UI
19 - **内容管理**: Contentlayer2
20 - **后端服务**: Supabase (PostgreSQL 数据库, 用户认证)
21 - **API**: Next.js App Router (Route Handlers)
22 - **表单**: React Hook Form + Zod
23 - **代码质量**: ESLint, Prettier, Husky
24
25 ## 开发指南与强制规范
26
27 ### API 开发规范
28 1. **文件结构**: 所有 API 必须位于 `app/api/` 目录下，并按功能划分。每个端点必须是 `route.ts` 文件。
29 2. **请求与响应**:
30 - 必须使用 `NextRequest` 和 `NextResponse` 对象。
31 - 成功响应应返回 `NextResponse.json({ success: true, data: ... })`。
32 - 失败响应应返回 `NextResponse.json({ success: false, error: '错误信息' }, { status: ... })`，并设置恰当的 HTTP 状态码（如 400, 401, 500）。
33 3. **错误处理**: 每个导出的 API 方法（`GET`, `POST` 等）都必须被一个顶层的 `try...catch` 块包裹，以捕获意外错误并返回标准的 500 错误响应。
34 4. **数据库交互**:
35 - **唯一入口**: 所有数据库操作必须通过从 `lib/supabase.ts` 导入的 `supabase` 客户端实例进行。严禁创建新的数据库连接。
36 - **查询规范**: 优先使用 Supabase 的 `select`, `insert`, `update`, `delete` 方法。对于复杂查询，可以使用 `.rpc()` 调用 PostgreSQL 函数。
37 5. **输入验证**: 必须对来自客户端的输入（`request.json()`, `searchParams`）进行验证。优先使用 `zod`（已在项目中引入）来定义和执行验证 schema。
38
39 ### 组件开发规范
40 1. **文件命名**: 组件文件和目录名使用 `PascalCase`，例如 `components/PageTitle/index.tsx`。
41 2. **Props 定义**:
42 - 必须为每个组件的 props 创建一个 TypeScript `interface` 或 `type`，命名为 `ComponentNameProps`。
43 - 严禁在 props 中使用 `any` 类型。
44 3. **样式**:
45 - **Tailwind 优先**: 必须优先使用 Tailwind CSS 工具类来定义样式。
46 - **自定义 CSS**: 仅在无法通过 Tailwind 实现时，才允许在 `css/` 目录下编写少量自定义 CSS，并确保其作用域受控，避免全局污染。
47 4. **状态管理**:
48 - **本地状态**: 使用 `useState` 和 `useReducer`。
49 - **全局状态**: 优先使用 React Context API (`createContext`) 结合 `useContext` Hook。`app/theme-providers.tsx` 是一个很好的例子。
50
51 ### 内容管理规范
52 1. **文章 (Blog)**:
53 - **位置**: `data/blog/`
54 - **格式**: `.mdx`
55 - **Frontmatter**: 必须包含 `title`, `date`, `summary`, `tags`。
56 2. **作者 (Authors)**:
57 - **位置**: `data/authors/`
58 - **格式**: `.mdx`
59 - **Frontmatter**: 必须包含 `name`。
60
61 ## 开发强制要求 ⚠️
62
63 1. **类型安全第一**:
64 - **严禁使用 `any`**: 除非有绝对必要且无法规避的情况，否则严禁使用 `any` 类型。若必须使用，需添加 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 并附上详细理由。
65 - **完整类型定义**: 所有函数参数、返回值和变量都应有明确的类型定义。
66 2. **代码质量检查**:
67 - **提交前必须 Lint**: 所有提交的代码都必须通过 `yarn lint` 检查且无任何错误。Husky 的 `pre-commit` hook 会强制执行此规则。
68 - **遵循 Prettier 格式**: 严禁手动调整由 Prettier 生成的代码格式。
69 3. **环境变量安全**:
70 - **严禁硬编码**: 严禁在代码中硬编码任何敏感信息（API 密钥、数据库连接字符串等）。
71 - **统一管理**: 所有敏感信息必须定义在 `.env.local` 文件中（该文件已被 `.gitignore` 忽略），并从 `.env.example` 复制模板。
72 4. **API 响应结构一致性**: 所有 API 端点返回的 JSON 结构必须保持一致。遵循 `开发指南` 中定义的成功和失败响应格式。
