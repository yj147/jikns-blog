# jikns_blog

现代化的 Next.js + Supabase 全栈博客与创作者社区。本仓库提供文章、动态（Activity）、标签、权限、搜索、监控等完整模块，核心业务通过 **Server Actions + Prisma 仓储** 实现，默认结合 **Supabase CLI** 提供本地 PostgreSQL/Auth 体验。

> 如果你是首次加入的开发者，请务必先阅读本文，然后到 `docs/9-search/` 获取搜索模块的详细架构与指南。

---

## 🎯 核心特性

- **统一搜索（9-search）**：PostgreSQL 全文检索结合 LIKE fallback，支持 tag/author/date/published 过滤、时间衰减排序、速率限制、fallback 监控与 UI 组件（SearchBar/Filters/Results）。
- **多内容形态**：文章（Post）、动态（Activity）、标签（Tag）、用户资料、关注/收藏/点赞等功能模块协同工作。
- **Supabase Dev Stack**：`supabase start` 一键启动本地 Postgres/Auth/Storage，配合 Prisma 中的 nodejieba 预处理保证中英文搜索体验。
- **质量门禁**：Vitest/Playwright 覆盖单元、集成、E2E；`pnpm quality:check` 聚合 lint + type-check + critical tests。
- **监控与日志**：`performanceMonitor` 记录 Server Action 耗时，`searchLogger` 捕捉 fallback、限流与关键事件。

---

## 🧱 技术栈

| 层级 | 技术 | 说明 |
| ---- | ---- | ---- |
| 前端 | Next.js 15 App Router、React 19、shadcn/ui、Tailwind CSS | 搜索页面、过滤器、结果卡片、导航等 UI 交互 |
| Server Actions | Next.js `use server` | `searchContent`、`getSearchSuggestions`、`searchAuthorCandidates` 等 |
| 数据层 | Prisma ORM + PostgreSQL (Supabase) | `search_vector`、ts_rank、View/Activity/Tag 仓储、Prisma middleware 注入 tokens |
| 搜索算法 | `nodejieba` 预分词 + `plainto_tsquery` | 兼容中英文混合文本，半衰期配置于 `lib/search/search-config.ts` |
| 基础设施 | Supabase CLI、Upstash Redis（可选） | 本地数据库/Auth、分布式限流存储 |
| 测试 | Vitest、Playwright、Testing Library | 单元/集成/E2E + 权限、安全专项脚本 |

---

## 🚀 快速开始

1. **准备依赖**
   ```bash
   corepack enable pnpm
   cp .env.example .env.local
   pnpm install
   ```
2. **启动本地 Supabase（推荐）**
   ```bash
   pnpm supabase:start
   ```
3. **生成 Prisma Client 与历史 token（首次）**
   ```bash
   pnpm db:generate
   pnpm search:tokens:backfill
   ```
4. **运行开发服务器**
   ```bash
   pnpm dev
   ```
   访问 `http://localhost:3999`，全局搜索页面位于 `/search`。

> 停止本地数据库：`pnpm supabase:stop`

---

## 📁 目录速览

```
app/                # Next.js App Router（搜索页、Server Components）
components/         # UI 组件（SearchBar / Filters / Results / Pagination 等）
lib/actions/        # Server Actions（search、tags、auth、rate limit 等）
lib/repos/search/   # 搜索仓储，含全文 SQL、fallback、共享工具
lib/search/         # rank-utils、search-params、tokenizer、search-config
prisma/             # Prisma schema、seed、middleware（nodejieba token）
docs/               # 各模块文档，9-search 详放于 docs/9-search/
tests/              # unit / integration / e2e（search fallback、visibility、actions）
scripts/            # backfill、权限/质量工具脚本
```

---

## 🔍 9-search 模块速览

| 关注点 | 入口 |
| ------ | ---- |
| 搜索仓储 | `lib/repos/search/posts.ts`、`activities.ts`（统一 SQL 管线 + withFallback） |
| 排序规则 | `lib/search/rank-utils.ts`（ts_rank × 时间衰减，半衰期在 `search-config.ts` 配置） |
| Server Actions | `lib/actions/search/`（`search-content.ts`、`search-suggestions.ts`、`search-authors.ts`，含 Zod 校验与限流） |
| UI 集成 | `components/search/`（SearchBar、SearchFilters、SearchResults、SearchSuggestions 等） |
| 文档 | `docs/9-search/搜索功能设计文档.md`、`搜索功能使用指南.md`、`M*-完成报告.md` |

> 搜索模块的审计、任务拆分与最佳实践均在 `docs/9-search/` 目录，请在修改该模块前先阅读。

---

## 🛠 常用脚本

| 目的 | 命令 |
| ---- | ---- |
| 开发服务器 | `pnpm dev` |
| 构建 / 生产启动 | `pnpm build && pnpm start` |
| 质量门禁（lint + type + format + critical tests） | `pnpm quality:check` |
| Lint / Type / Format 单独执行 | `pnpm lint:check` / `pnpm type-check` / `pnpm format:check` |
| 全量测试（含覆盖率） | `pnpm test:all` |
| 搜索 fallback 集成测试 | `pnpm vitest tests/integration/search-fallback.test.ts --run` |
| 搜索可见性保障 | `pnpm vitest tests/repos/search-visibility.test.ts --run` |
| 搜索 Server Actions 测试 | `pnpm vitest tests/actions/search.test.ts --run` |
| Playwright E2E | `pnpm test:e2e` / `pnpm test:e2e:ui` |
| 回填搜索 tokens | `pnpm search:tokens:backfill` |

更多脚本参见 `package.json` 的 `scripts` 字段。

---

## 🧪 测试策略

- **Vitest**
  - `tests/integration/search-fallback.test.ts`：验证全文 → LIKE 降级时 tag/author/date/onlyPublished 一致性。
  - `tests/repos/search-visibility.test.ts`：保障 fallback 过滤 deletedAt、用户状态等可见性规则。
  - `tests/actions/search.test.ts`：覆盖 `searchContent`、`getSearchSuggestions`、`searchAuthorCandidates` 的输入校验、限流、分页、排序逻辑。
- **Playwright**：`pnpm test:e2e` 覆盖搜索 UI（输入、过滤器、分页、结果卡片）与权限流程。
- **覆盖率目标**：见 `vitest.config.ts`（Lines ≥ 85%，Branches ≥ 70%）。

---

## 📚 重要文档

- `docs/9-search/搜索功能设计文档.md`
- `docs/9-search/搜索功能使用指南.md`
- `docs/9-search/M*-完成报告.md`
- `docs/database-migration-notes.md`
- `AGENTS.md`（Linus 模式、协作规范）

---

## 🤝 贡献说明

1. 阅读 `AGENTS.md`，遵循 Linus 模式与仓库规范。
2. 变更前运行最少 `pnpm quality:check`，提交前推荐 `pnpm quality:fix`。
3. 若修改搜索相关逻辑，请同步更新 `docs/9-search/` 与对应测试。
4. 提交信息遵循 Conventional Commits，例如 `feat(search): add post suggestions cache`。

欢迎反馈问题与改进建议，可在 Issues / Discussions / PR 中说明。谢谢！
