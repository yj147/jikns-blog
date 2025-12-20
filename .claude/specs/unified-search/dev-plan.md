# 统一搜索 - 开发计划

## 功能概述

提供导航栏入口的一站式全文搜索，支持 Post/Activity/User/Tag 四类内容，按类型过滤，时间加权排序，分页展示 20-40 条结果。

## 任务分解

### 任务 1: 数据库 FTS 索引与迁移

- **ID**: task-1
- **描述**: 为 Post、Activity、User、Tag 表建立 `tsvector`
  列与 GIN 索引，定义搜索加权策略（标题权重 A > 内容权重 B），配置中英文分词器（`english` +
  `simple`），生成 Supabase 迁移文件并验证索引性能
- **文件范围**: `prisma/schema.prisma`, `supabase/migrations/*.sql`
- **依赖**: 无
- **测试命令**:
  `pnpm db:migrate && pnpm test tests/unit/search-index.test.ts --coverage`
- **测试重点**: 索引创建成功、查询计划使用 GIN 索引（EXPLAIN
  ANALYZE）、空查询被拒绝、中英文分词正确、多表联合查询 < 200ms

### 任务 2: 搜索服务与 API 路由

- **ID**: task-2
- **描述**: 实现搜索服务层（`lib/services/search.ts`）封装多表联合查询，使用 Prisma
  `$queryRaw`
  执行 FTS 查询，支持类型过滤（all/post/activity/user/tag）、分页（每类 5-10 条，总量 ≤40）、时间权重排序（`ts_rank * 0.7 + time_decay * 0.3`）；构建 API 路由（`app/api/search/route.ts`）处理参数校验、CSRF 防护、限流（10 次/分钟/IP）、错误处理
- **文件范围**: `lib/services/search.ts`, `app/api/search/route.ts`,
  `types/search.ts`
- **依赖**: 依赖 task-1
- **测试命令**:
  `pnpm test tests/api/search.test.ts tests/services/search.test.ts --coverage`
- **测试重点**: 查询参数校验（长度 1-100 字符、SQL 注入防护）、每类结果数量限制、排序正确性（新内容优先）、排除评论表、错误边界处理（索引失败降级到 LIKE）、限流机制触发、空结果返回空数组

### 任务 3: 搜索 UI 与导航集成

- **ID**: task-3
- **描述**: 在导航栏（`components/navigation-server.tsx`）添加搜索输入框（Cmd/Ctrl+K 快捷键、回车跳转
  `/search?q=...`）；实现搜索结果页（`app/search/page.tsx`）包含 Tab 切换（All/Post/Activity/User/Tag）、结果列表卡片、分页控件（禁用态逻辑）、加载骨架屏、空态提示、错误重试按钮、键盘导航支持（↑↓ 选择、Enter 跳转）
- **文件范围**: `components/navigation-server.tsx`, `app/search/page.tsx`,
  `components/search/*.tsx`, `hooks/use-search.ts`
- **依赖**: 依赖 task-2
- **测试命令**:
  `pnpm test tests/ui/search-page.test.tsx tests/ui/search-input.test.tsx --coverage && pnpm test:e2e tests/e2e/search.spec.ts`
- **测试重点**:
  Tab 切换正确更新 URL 参数（`type=post`）、分页按钮禁用逻辑（首页禁用 Previous、末页禁用 Next）、空结果显示"未找到相关内容"、错误状态显示重试按钮、快捷键 Cmd+K 弹出搜索框、键盘导航可用、搜索框防抖 300ms、无障碍属性（aria-label）

## 验收标准

- [ ] 支持同时搜索 Post、Activity、User、Tag 四类内容
- [ ] 搜索结果按时间加权排序（新内容优先，相关性次之）
- [ ] 每类结果限制 5-10 条，总量不超过 40 条
- [ ] 导航栏搜索框可用，Cmd/Ctrl+K 快捷键触发，回车跳转结果页
- [ ] 结果页 Tab 切换流畅，URL 参数同步，分页逻辑正确
- [ ] 空态、加载态、错误态体验一致，有明确提示
- [ ] 所有单元测试通过（API、服务层、UI 组件）
- [ ] 代码覆盖率 ≥90%（statements/branches/functions/lines）
- [ ] E2E 测试覆盖核心搜索流程（输入 → 跳转 → Tab 切换 → 分页）
- [ ] 查询性能 < 500ms（本地 Supabase，50 条记录基准）
- [ ] 限流机制生效（10 次/分钟/IP，返回 429）
- [ ] SQL 注入防护（拒绝特殊字符 `--`, `/*`, `';`）

## 技术要点

- **索引策略**: 使用 PostgreSQL
  `to_tsvector('english', title || ' ' || content)` 与
  `to_tsvector('simple', title || ' ' || content)`
  组合支持中英文，GIN 索引加速查询（`CREATE INDEX idx_post_fts ON Post USING GIN (search_vector)`）
- **排序公式**:
  `ts_rank(search_vector, query) * 0.7 + exp(-EXTRACT(EPOCH FROM (NOW() - created_at)) / 2592000) * 0.3`
  平衡相关性与时效性（30 天衰减期）
- **安全限制**: 查询长度 1-100 字符，限流 10 次/分钟/IP（使用 Upstash
  Redis），拒绝 SQL 注入风险字符（正则过滤 `[\-\;\/\*]`）
- **分页约束**: 前端默认 `pageSize=10`，后端最大
  `pageSize=20`，避免过度加载；使用 `OFFSET`/`LIMIT` 实现分页（数据量 <
  1000 条可接受）
- **缓存策略**: API 路由使用 Next.js
  `export const revalidate = 60`，热门查询缓存 1 分钟；结果页使用 SWR 客户端缓存（`staleTime: 5min`）
- **降级方案**: FTS 查询失败时回退到 `ILIKE '%query%'`
  模糊匹配（记录性能警告日志）
- **类型安全**: 使用 Zod 校验 API 参数（`SearchParamsSchema`），服务层返回类型化
  `SearchResult<T>` 泛型接口
- **中文分词**: 使用 `nodejieba`
  在服务端预处理中文查询词（`jieba.cut(query, true)`），提升 FTS 匹配精度
