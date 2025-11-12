# OPENAI.md - 工作指南 (v4.1)

## 🚨 CRITICAL RULE - 强制语言规则

**必须始终使用中文回答问题和交流**

- 所有解释、说明、思考过程和回复必须使用简体中文
- 代码实体（变量名、函数名、类名）与技术术语保持英文不变
- 注释尽量使用中文，禁止行尾注释（如 `code // 注释`）

---

本文件为 OpenAI（Codex CLI /
ChatGPT）在此现代化个人博客与社交动态项目中高效、精准协作的专属规则。开始工作前请熟悉并严格遵循下述规范与仓库约定。

## 核心参考资料 (Core References)

1. `docs/0-foundations/现代博客项目架构设计.md`（v4.1）— 技术栈、版本、数据模型与部署的唯一蓝图
2. `docs/0-foundations/现代化博客需求文档.md`（v4.0）— 功能范围与用例的唯一依据
3. `docs/0-foundations/项目实施路线指南.md`（v4.0）— 路线图与方法论
4. `AGENTS.md` — 仓库级工程与质量基线（目录、命令、风格、测试）

## 第一部分：工作原则 (Guiding Principles)

### 1. 可读性优先

- 代码是写给人看的，清晰度 > 简短；命名语义化；模块职责单一

### 2. DRY（避免重复）

- 杜绝复制粘贴；抽象公共逻辑到 `@/lib`、`@/hooks`、可复用组件到 `@/components`

### 3. 高内聚、低耦合

- 相关功能归档同处，模块间依赖最小化；文件放置严格遵循项目结构

### 4. 避免过度工程化

- 以需求与当前问题为边界，不引入无必要的库、层或微服务
- 坚持 Next.js + Supabase 全栈路线，不另起独立后端

### 5. 本地优先

- Supabase CLI 本地实例开发与验证；先本地跑通，再上云端

## 第二部分：执行准则 (Actionable Rules)

### A. 沟通与协作

- 按任务开始前给出简短前置说明（做什么、为何、下一步）
- 多步骤任务维护清晰的计划与进度（小步快跑，可回滚）
- 出现不确定性时先提出选项与权衡，再询问决策

### B. 调试与修复

- 坚决修复编译/类型/运行错误，禁止以占位或虚假实现“绕过”
- 优先根因修复（Root Cause Fix），避免表面 Patch
- 若路径不可达，提供与既定技术栈相容的备选方案

### C. 代码与目录组织

- 新文件严格放入：`app/` 页面与 API、`components/` 组件、`lib/` 工具、`hooks/`
  自定义 hooks、`types/` 类型、`styles/` 样式
- 路径别名统一使用 `@/...`
- 文件命名 kebab-case；组件导出 PascalCase；hooks 以 `use` 开头
- 仅在必要处使用 `'use client'`，优先 RSC（服务器组件）

### D. 提交与文档

- 遵循 Conventional Commits（如 `feat: ...`、`fix(auth): ...`）
- 不新增零散总结文档；优先更新现有文档（如 README / 架构/需求/路线）
- 关键变更更新相应 docs 与注释；避免大段无效注释

### E. 安全与配置

- `.env.example` → `.env.local`，不提交任何密钥
- 避免生产代码使用 `console.log`；采用结构化错误与安全日志

## 第三部分：项目强制约束 (Repository Enforcement)

### 1) 包管理与命令

- 仅使用 pnpm：`pnpm dev | build | start | test | type-check | lint:check | format:check`
- 质量基线：`pnpm quality:check`（或 `quality:fix`）在提交/合并前必须通过

### 2) 数据库与迁移（Schema First）

1. 在 `prisma/schema.prisma` 定义/修改模型
2. 确保本地 Supabase 已启动（`pnpm supabase:start`）
3. `pnpm db:push` 将变更推送至本地数据库
4. 使用 `supabase db diff -f "migration_description"`
   生成 SQL 迁移（提交到 Git）
5. 需要时 `pnpm db:generate` 更新 Prisma Client

### 3) 认证与授权

- 认证：GitHub OAuth + 邮箱/密码（按架构/需求文档）
- 授权：
  - 博客模块（Post/Series 等）需 `role = ADMIN`
  - 动态模块（Activity/互动）要求用户已登录且 `status = ACTIVE`

### 4) 测试与覆盖率

- 单测/集成：Vitest + Testing Library（`environment: jsdom`）
- E2E：Playwright（用 `pnpm dev` 启动后运行）
- 覆盖率门槛：lines ≥ 85%，branches ≥ 70%（见 `vitest.config.ts`）
- 测试用例放于 `tests/**`，命名 `*.test.ts(x)` / `*.spec.ts(x)`

### 5) 代码风格

- Prettier：2 空格、宽度 100、双引号、无分号、尾随逗号（见 `.prettierrc`）
- Tailwind：遵循 `prettier-plugin-tailwindcss` 的类顺序
- ESLint：扩展 `next/core-web-vitals`；偏好 `const`、禁止 `var`、使用 `eqeqeq`

## 第四部分：常用工作清单 (Checklists)

### 开发前

- [ ] 明确需求来源：架构/需求/路线三件套 + 相关 issue
- [ ] 选择目标模块与文件归属（遵循目录规范与别名）
- [ ] 准备本地环境：`pnpm i`、`pnpm supabase:start`（如涉及数据库）

### 开发中

- [ ] 小步提交，保证 `pnpm quality:check` 常绿
- [ ] 对外 API/类型/边界条件有测试覆盖
- [ ] 遵循 RSC 优先，谨慎标注 `use client`

### 开发后（Definition of Done）

- [ ] 本地运行通过：构建、类型、Lint、关键测试
- [ ] 相关文档已更新（或在 PR 描述中记录迁移/配置变更）
- [ ] 安全检查：无泄露密钥与敏感日志

## 第五部分：记忆与记录 (Project Memory)

- 每个完整工作流程结束后：
  - 在 `memory/session/` 创建会话日志总结
  - 在 `memory/task/` 更新任务报告
  - 定期维护 `memory/task-status.md` 与 `memory/technical-decisions.md`

## 第六部分：命令速查 (Cheatsheet)

```bash
# 开发相关
pnpm dev
pnpm build && pnpm start
pnpm lint:check && pnpm format:check && pnpm type-check
pnpm quality:check

# 测试
pnpm test
pnpm test:watch
pnpm test:e2e
pnpm test:coverage

# 数据库（需本地 Supabase）
pnpm supabase:start   # 启动本地栈
pnpm supabase:stop    # 停止本地栈
pnpm db:push          # 推送 schema
pnpm db:migrate       # 生成迁移描述文件
pnpm db:generate      # 生成 Prisma 客户端
```

## 第七部分：非目标与边界 (Non‑Goals)

- 不新增与架构/需求无关的功能与依赖
- 不引入 npm/yarn 作为包管理器
- 不创建零散的新规范文档（复用/更新现有文档）
- 不为绕过问题编写临时/虚假实现

## 第八部分：出现分歧时的决策阶梯

1. 查阅架构/需求/路线/AGENTS 文档 → 以其为准
2. 在既定技术栈内列出 2–3 个可行方案（优缺点/影响面）
3. 选择最小变更、最可验证、对质量基线影响最小的方案
4. 需跨边界决策时，提出建议并请求确认

—— 本指南与 `CLAUDE.md`、`GEMINI.md`
一致，结合本仓库 AGENTS 约束，为 OpenAI 代理在该代码库内工作的唯一执行规范。若有冲突，以架构与需求文档为最高优先。
