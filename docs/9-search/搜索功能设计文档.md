# Phase 11：搜索功能设计文档

**版本**: v1.0  
**发布日期**: 2025-10-09  
**撰写人**: Linus 模式技术助手  
**关联阶段**: Phase 11（搜索功能）

---

## 1. 背景 & 目标

### 1.1 背景

- Phase
  5-10 已完成博客文章、动态、评论、点赞收藏、关注、标签等核心功能模块，内容生态已经成熟。
- 当前各模块的搜索功能分散且不统一：
  - 博客文章：通过 `q` 参数进行简单的 `contains` 模糊搜索
  - 标签：通过 `search` 参数进行名称模糊匹配
  - 动态：已实现 PostgreSQL 全文搜索（`search_vector` + GIN 索引）
- 用户缺乏统一的搜索入口，无法跨内容类型进行搜索，内容发现效率低下。
- 现有搜索功能缺少高级过滤、搜索建议、历史记录等增强特性。

### 1.2 目标

1. 建立统一的搜索系统，支持跨内容类型（文章、动态、用户、标签）的全文搜索。
2. 为 Post 模型添加 PostgreSQL 全文搜索支持，与 Activity 保持一致的技术方案。
3. 提供全局搜索入口和专用搜索结果页面，优化用户搜索体验。
4. 实现搜索结果的智能排序和相关性评分，提升搜索质量。
5. 支持高级搜索过滤器（按类型、日期、标签、作者等），满足精准搜索需求。
6. 实现搜索建议（自动补全）和搜索历史记录，提升搜索效率。

### 1.3 成功判定

- ✅ 用户可以通过全局搜索框搜索文章、动态、用户、标签。
- ✅ 搜索结果按相关性排序，支持按类型分组展示。
- ✅ 支持高级过滤器（内容类型、发布日期、标签、作者）。
- ✅ 搜索建议功能正常工作，提供实时的搜索关键词补全。
- ✅ 搜索历史记录保存在本地，支持快速重复搜索。
- ✅ 搜索性能 < 1秒，支持分页加载大量结果。
- ✅ 搜索功能在移动端和桌面端均有良好体验。

---

## 2. 范围界定

### 2.1 In Scope

- **全文搜索引擎**：基于 PostgreSQL 的 tsvector 和 GIN 索引实现全文搜索。
- **搜索范围**：
  - 博客文章（标题、内容、摘要、SEO 描述）
  - 动态内容（Activity 的 content 字段）
  - 用户信息（用户名、简介）
  - 标签（标签名称、描述）
- **搜索功能**：
  - 统一搜索 API（`/api/search/` 或 Server Action）
  - 全局搜索框组件（导航栏集成）
  - 搜索结果页面（`/search/`）
  - 搜索建议/自动补全
  - 搜索历史记录（本地存储）
- **高级过滤**：
  - 按内容类型过滤（文章/动态/用户/标签）
  - 按发布日期范围过滤
  - 按标签过滤（仅文章）
  - 按作者过滤（仅文章和动态）
- **性能优化**：
  - 搜索结果实时查询（依赖数据库索引，不做跨请求缓存）
  - 分页加载（默认 20 条/页）
  - 搜索防抖（300ms）

> **架构简化说明**: 基于 Linus
> Torvalds 式技术审计，我们彻底移除搜索结果缓存，改为“实时查询 +
> per-query 搜索建议缓存”，并保持速率限制通过环境变量可配置。详见
> [架构简化说明.md](./架构简化说明.md)。

### 2.2 Out of Scope

- 第三方搜索引擎集成（Elasticsearch、Algolia 等）。
- 搜索结果的个性化推荐和机器学习排序。
- 搜索分析和统计（热门搜索词、搜索趋势）。
- 语义搜索和自然语言处理（NLP）。
- 搜索结果的高亮显示（可在后续迭代中添加）。
- 图片和文件内容的搜索。

---

## 3. 依赖 & 前置条件

| 类型      | 说明                                           | 状态                                                                                    |
| --------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| 数据模型  | `Post`, `Activity`, `User`, `Tag` 模型         | ✅ 已存在                                                                               |
| 全文搜索  | Activity 的 `search_vector` 字段和 GIN 索引    | ✅ 已实现 (`prisma/migrations/20250927193542_add_activity_search_vector/migration.sql`) |
| 认证抽象  | `requireAuth`, `requireAdmin`                  | ✅ Phase 2-4 完成                                                                       |
| 标签系统  | 标签查询和搜索 API                             | ✅ Phase 10 完成                                                                        |
| UI 组件库 | shadcn/ui 基础组件                             | ✅ 已配置                                                                               |
| 响应规范  | `createSuccessResponse`, `createErrorResponse` | ✅ 架构收敛完成                                                                         |

---

## 4. 架构总览

### 4.1 技术方案选型

**选择 PostgreSQL 全文搜索的理由**：

1. **已有基础**：Activity 模型已实现 tsvector + GIN 索引，技术方案成熟可靠。
2. **零额外依赖**：无需引入 Elasticsearch 等第三方服务，降低系统复杂度。
3. **性能足够**：对于中小规模博客（<
   10万篇文章），PostgreSQL 全文搜索性能完全满足需求。
4. **维护简单**：与主数据库统一管理，无需额外的索引同步和运维成本。
5. **成本低**：无需额外的搜索服务费用，适合个人博客项目。

**技术栈**：

- **搜索引擎**：PostgreSQL 全文搜索（tsvector + GIN 索引）
- **查询语法**：`plainto_tsquery` 和 `to_tsquery`
- **权重配置**：
  - 文章标题：权重 A（最高）
  - 文章摘要/SEO 描述：权重 B
  - 文章内容：权重 C
  - 标签名称：权重 D
- **排序算法**：`ts_rank` 相关性评分 + 发布时间衰减

### 4.2 组件与交互流程

```
用户输入搜索词 → 全局搜索框（防抖 300ms）
                → 搜索建议 API（实时返回前 5 条建议）
                → 用户选择建议或按回车
                → 跳转到搜索结果页 `/search?q=关键词&type=all`

搜索结果页 → Server Action: searchContent()
          → 并行查询：
             - searchPosts()     → Post.search_vector 全文搜索
             - searchActivities() → Activity.search_vector 全文搜索
             - searchUsers()      → User.name/bio 模糊搜索
             - searchTags()       → Tag.name/description 模糊搜索
          → 合并结果 + 按相关性排序
          → 分页返回（默认 20 条/页）
          → 渲染搜索结果列表

高级过滤 → 用户选择过滤条件（类型/日期/标签/作者）
        → 更新 URL 参数
        → 重新执行搜索查询
        → 更新搜索结果
```

### 4.3 服务分层

- **Server
  Actions 层**：`lib/actions/search/`，统一的搜索入口，负责参数验证、权限检查、结果聚合。
- **仓储层**：
  - `lib/repos/search/posts.ts`、`lib/repos/search/activities.ts`、`lib/repos/search/users.ts`、`lib/repos/search/tags.ts`：封装各类型的搜索逻辑，包括全文/模糊搜索查询构建。
  - 复用现有的 `tag-repo.ts`、`activity-repo.ts` 等。
- **UI 层**：
  - `components/search/search-bar.tsx`：全局搜索框组件
  - `components/search/search-suggestions.tsx`：搜索建议组件
  - `components/search/search-filters.tsx`：高级过滤器组件
  - `components/search/search-results.tsx`：搜索结果列表组件
- **页面层**：`app/search/page.tsx`，搜索结果页面，负责数据获取和 SEO 优化。

---

## 5. 数据模型 & 索引策略

### 5.1 Prisma Schema 变更

需要为 `Post` 模型添加 `search_vector` 字段，与 `Activity` 保持一致：

```prisma
model Post {
  // ... 现有字段 ...
  searchVector  Unsupported("tsvector")? @map("search_vector")

  // ... 现有关系和索引 ...
}
```

### 5.2 数据库迁移 SQL

创建迁移文件：`supabase/migrations/YYYYMMDDHHMMSS_add_post_search_vector.sql`

```sql
-- Phase 11: 为 Post 模型添加全文搜索支持

-- 添加 search_vector 列（生成列，自动维护）
ALTER TABLE posts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("seoDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C')
  ) STORED;

-- 创建 GIN 索引以加速全文搜索
CREATE INDEX idx_posts_search_vector
  ON posts USING GIN (search_vector);

-- 为 User 模型添加搜索索引（可选，如果需要用户搜索）
CREATE INDEX idx_users_name_trgm
  ON users USING GIN (name gin_trgm_ops);

CREATE INDEX idx_users_bio_trgm
  ON users USING GIN (bio gin_trgm_ops);

-- 启用 pg_trgm 扩展（用于模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

**说明**：

- `GENERATED ALWAYS AS ... STORED`：自动维护的生成列，当 title/excerpt/content 更新时自动重新计算。
- `setweight()`：为不同字段设置权重，A > B > C > D，影响相关性排序。
- `GIN 索引`：倒排索引，适合全文搜索，查询性能优秀。
- `pg_trgm`：三元组模糊搜索扩展，用于用户名和简介的模糊匹配。

### 5.3 索引策略总结

| 内容类型 | 搜索字段                | 索引类型     | 权重 |
| -------- | ----------------------- | ------------ | ---- |
| Post     | title                   | tsvector (A) | 最高 |
| Post     | excerpt, seoDescription | tsvector (B) | 高   |
| Post     | content                 | tsvector (C) | 中   |
| Activity | content                 | tsvector (A) | 最高 |
| User     | name, bio               | pg_trgm      | N/A  |
| Tag      | name, description       | pg_trgm      | N/A  |

---

## 6. API 设计

### 6.1 统一搜索 API

**Server Action**: `searchContent()`

**文件位置**: `lib/actions/search/`

**接口（2025-11-07 更新）**:

```typescript
export async function searchContent(
  params: Partial<SearchParams>
): Promise<ApiResponse<SearchResults>>

interface SearchParams {
  query: string
  type: SearchContentType // "all" | "posts" | "activities" | "users" | "tags"
  page: number // >=1
  limit: number // 1..50 (固定 20)
  authorId?: string
  tagIds?: string[]
  publishedFrom?: Date
  publishedTo?: Date
  onlyPublished: boolean // 后端根据用户角色强制 true/false
}

interface SearchResults {
  posts: SearchResultBucket<SearchPostResult>
  activities: SearchResultBucket<SearchActivityResult>
  users: SearchResultBucket<SearchUserResult>
  tags: SearchResultBucket<SearchTagResult>
  overallTotal: number
  query: string
  type: SearchContentType
}

interface SearchResultBucket<T> {
  items: T[]
  total: number
  hasMore: boolean
  page: number
  limit: number
}
```

**安全策略（新增）**

1. `searchContent` 内部调用 `getCurrentUser()`；若
   `role !== "ADMIN"`，则即便传入 `onlyPublished=false` 也会被强制改回 true。
2. 请求入口附带速率限制：
   - 未认证：`search:content:ip:{ip}`，默认 120 次 / 分钟。
   - 已认证：`search:content:user:{userId}`，默认 60 次 / 分钟。
3. 所有 Server Action 需受 `next.config.mjs` `serverActions.allowedOrigins`
   约束，Nginx/反代需同步白名单。

**响应示例**:

```json
{
  "success": true,
  "data": {
    "posts": {
      "items": [
        {
          "id": "post1",
          "slug": "nextjs-15-features",
          "title": "Next.js 15 新特性详解",
          "excerpt": "深入探讨 Next.js 15 的新功能...",
          "published": true,
          "publishedAt": "2025-10-01T10:00:00.000Z",
          "author": { "id": "user1", "name": "张三", "avatarUrl": null },
          "tags": []
        }
      ],
      "total": 25,
      "hasMore": true,
      "page": 1,
      "limit": 20
    },
    "activities": {
      "items": [],
      "total": 0,
      "hasMore": false,
      "page": 1,
      "limit": 20
    },
    "users": {
      "items": [],
      "total": 0,
      "hasMore": false,
      "page": 1,
      "limit": 20
    },
    "tags": {
      "items": [],
      "total": 0,
      "hasMore": false,
      "page": 1,
      "limit": 20
    },
    "overallTotal": 25,
    "query": "nextjs",
    "type": "posts"
  }
}
```

### 6.2 搜索建议 API

**Server Action**: `getSearchSuggestions()`

**函数签名**:

```typescript
export async function getSearchSuggestions(
  query: string,
  limit: number = 5
): Promise<ApiResponse<SearchSuggestion[]>>

interface SearchSuggestion {
  text: string
  type: "post" | "tag" | "user"
  count?: number // 匹配结果数量
}
```

**实现逻辑**:

1. 查询标签名称（前缀匹配，最多 2 条）
2. 查询文章标题（前缀匹配，最多 2 条）
3. 查询用户名（前缀匹配，最多 1 条）
4. 合并结果，按匹配度排序

---

## 7. 用户界面设计

### 7.1 全局搜索框

**位置**: 导航栏（`components/navigation.tsx`）

**功能**:

- 输入框：占位符"搜索文章、动态、用户..."
- 搜索图标：点击触发搜索
- 快捷键：`Ctrl/Cmd + K` 聚焦搜索框
- 防抖：300ms 延迟，避免频繁请求
- 搜索建议：输入 2 个字符后显示下拉建议列表
- 历史记录：显示最近 5 次搜索（本地存储）

**交互流程**:

1. 用户输入关键词
2. 300ms 后触发搜索建议 API
3. 显示下拉建议列表（标签、文章、用户）
4. 用户选择建议或按回车
5. 跳转到搜索结果页 `/search?q=关键词`

### 7.2 搜索结果页面（2025-11-07 现状）

- 顶部 `SearchBar`（客户端）+ Server Component 页面。
- 页面负责：解析 `searchParams` → `parseSearchParams` → `searchContent`。
- 主区域由 `SearchResults`（Server Component）渲染，内部再调用 `searchContent`。
- 侧边栏 `SearchFilters` 仍为客户端组件，接管 URL 过滤；新增 `allowDraftToggle`
  仅在管理员显示“草稿”开关。
- 无分页 API 接口；通过 `SearchPagination` 组件根据 `hasMore`
  生成上一页/下一页链接。

### 7.3 搜索结果卡片

**文章结果卡片**:

- 标题（加粗，点击跳转）
- 摘要（最多 200 字符，关键词高亮）
- 元信息：作者头像 + 名称、发布日期、阅读量
- 标签列表（最多显示 3 个）
- 相关性评分（仅调试模式）

**动态结果卡片**:

- 内容预览（最多 150 字符，关键词高亮）
- 作者头像 + 名称、发布时间
- 互动数据：点赞数、评论数

**用户结果卡片**:

- 用户头像（大）
- 用户名（加粗）
- 简介（最多 100 字符）
- 关注按钮（如果未关注）
- 统计数据：文章数、粉丝数

**标签结果卡片**:

- 标签名称（带颜色标识）
- 描述（如果有）
- 文章数量
- 点击跳转到标签详情页

---

## 8. 性能优化策略

### 8.1 搜索查询优化

1. **索引优化**：
   - 使用 GIN 索引加速全文搜索
   - 为常用过滤字段（published, createdAt）添加复合索引

2. **查询优化**：
   - 使用 `LIMIT` 限制结果数量
   - 并行执行多个搜索查询（Promise.all）
   - 只查询必要字段（使用 Prisma select）

3. **相关性排序**：
   ```sql
   SELECT *, ts_rank(search_vector, query) AS rank
   FROM posts
   WHERE search_vector @@ query
   ORDER BY rank DESC, published_at DESC
   LIMIT 20;
   ```

### 8.2 缓存策略

**实际实现**：搜索结果保持实时查询；只有搜索建议使用 Next.js `unstable_cache`
做 60 秒的 per-query 缓存。

1. **搜索结果**：
   - 直接命中 PostgreSQL（tsvector / pg_trgm 索引）
   - 不做跨请求缓存，避免 deletedAt/status 等可见性变更滞后

2. **搜索建议缓存**：
   - `fetchSearchSuggestionsData` 以小写 query + limit 为键，`revalidate: 60`
   - 通过 `tags: ["search-suggestions"]` 支持主动失效

3. **扩展思路**：
   - 若后续需要更多吞吐，可在搜索建议层引入 Redis/LFU，但必须保持当前可见性策略

详见 [架构简化说明.md](./架构简化说明.md)。

### 8.3 前端优化

1. **防抖**：
   - 搜索输入防抖：300ms
   - 搜索建议防抖：300ms（`useDebounce`）

2. **懒加载**：
   - 搜索结果分页加载
   - 图片懒加载（使用 Next.js Image 组件）

3. **本地存储**：
   - 搜索历史保存在 localStorage
   - 最多保存 10 条历史记录

---

## 9. 安全性考虑

### 9.1 输入验证

1. **搜索关键词**：
   - 最小长度：1 个字符
   - 最大长度：100 个字符
   - 过滤特殊字符：防止 SQL 注入（Prisma 自动处理）

2. **参数验证**：
   - 使用 Zod schema 验证所有输入参数
   - 限制 limit 参数：1-50 之间

### 9.2 权限控制

1. **内容可见性**：
   - 只搜索已发布的文章（`published: true`）
   - 只搜索未删除的动态（`deletedAt IS NULL`）
   - 只搜索活跃用户（`status: ACTIVE`）

2. **敏感信息过滤**：
   - 用户搜索结果不包含邮箱、密码等敏感信息
   - 使用 Prisma select 明确指定返回字段

### 9.3 速率限制 ⚡ _可配置_

**实际实现**：`checkSearchRateLimit`
统一保护搜索内容、搜索建议、作者候选接口，阈值通过环境变量驱动。

**默认策略**：

- 每个用户：60 次/分钟（`SEARCH_RATE_LIMIT_PER_USER`）
- 每个 IP：120 次/分钟（`SEARCH_RATE_LIMIT_PER_IP`）
- 窗口：60 秒（`SEARCH_RATE_LIMIT_WINDOW_MS`）
- `SEARCH_RATE_LIMIT_ENABLED=false` 时可完全关闭

**当前实现**：

```typescript
export async function checkSearchRateLimit(params: CheckSearchRateLimitParams) {
  const config = loadSearchRateLimitConfig()
  if (!config.enabled) return { allowed: true }

  const userKey = params.userId ? `search:content:user:${params.userId}` : null
  const ipKey = `search:content:ip:${params.ip ?? "anonymous"}`

  if (userKey) {
    const result = await applyDistributedRateLimit(
      userKey,
      config.perUser,
      config.windowMs
    )
    if (!result.allowed) {
      return { allowed: false, retryAfter: result.retryAfter }
    }
  }

  return applyDistributedRateLimit(ipKey, config.perIP, config.windowMs)
}
```

- `searchContent`、`getSearchSuggestions`、`searchAuthorCandidates` 均调用该函数
- 无额外“建议专用”限流，所有入口共享同一速率策略

详见 [架构简化说明.md](./架构简化说明.md)。

---

## 10. 测试策略

### 10.1 单元测试

**测试文件**: `tests/actions/search.test.ts`

**测试用例**:

- ✅ 搜索文章：验证全文搜索和相关性排序
- ✅ 搜索动态：验证 Activity 搜索功能
- ✅ 搜索用户：验证用户名和简介模糊搜索
- ✅ 搜索标签：验证标签名称搜索
- ✅ 高级过滤：验证日期、标签、作者过滤
- ✅ 分页功能：验证分页参数和结果
- ✅ 参数验证：验证非法输入的错误处理
- ✅ 权限控制：验证只返回可见内容

### 10.2 集成测试

**测试文件**: `tests/integration/search.test.ts`

**测试场景**:

- ✅ 端到端搜索流程：从输入到结果展示
- ✅ 搜索建议功能：验证实时建议
- ✅ 搜索历史记录：验证本地存储

### 10.3 E2E 测试

**测试文件**: `tests/e2e/search.spec.ts`

**测试场景**:

- ✅ 用户在导航栏输入搜索关键词
- ✅ 用户选择搜索建议
- ✅ 用户在搜索结果页使用高级过滤器
- ✅ 用户点击搜索结果跳转到详情页
- ✅ 用户使用搜索历史快速搜索

---

## 11. 实施风险 & 缓解措施

### 11.1 技术风险

| 风险                        | 影响 | 概率 | 缓解措施                                                                                         |
| --------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------ |
| PostgreSQL 全文搜索性能不足 | 高   | 低   | 1. 优化索引和查询<br>2. 必要时扩展搜索建议缓存层<br>3. 预留升级到 Elasticsearch 的接口           |
| 搜索结果相关性不佳          | 中   | 中   | 1. 调整字段权重<br>2. 引入时间衰减因子<br>3. 收集用户反馈持续优化                                |
| 中文分词效果差              | 中   | 中   | 1. 应用层使用 nodejieba 生成 token<br>2. 如迁移至自托 PG/外部搜索，再评估 zhparser / Meilisearch |

### 11.2 业务风险

| 风险                   | 影响 | 概率 | 缓解措施                                                                  |
| ---------------------- | ---- | ---- | ------------------------------------------------------------------------- |
| 用户搜索习惯与设计不符 | 中   | 中   | 1. 提供搜索帮助文档<br>2. 收集搜索日志分析用户行为<br>3. 迭代优化搜索体验 |
| 搜索结果过多或过少     | 低   | 低   | 1. 提供高级过滤器<br>2. 优化搜索建议<br>3. 显示"未找到结果"的友好提示     |

---

## 12. 后续优化方向

### 12.1 短期优化（Phase 11 完成后 1-2 个月）

- 搜索结果关键词高亮显示
- 搜索分析和统计（热门搜索词、搜索失败率）
- 搜索结果的缩略图预览

### 12.2 中期优化（3-6 个月）

- 中文分词优化（扩充 nodejieba 词典；自托环境可评估 zhparser）
- 搜索结果的个性化推荐
- 接入 Meilisearch/Typesense，增强排序与模糊匹配

### 12.3 长期优化（6 个月以上）

- 升级到 Elasticsearch（如果流量增长）
- 语义搜索和自然语言处理
- 搜索结果的 AI 摘要

---

## 13. 参考资料

- [PostgreSQL 全文搜索官方文档](https://www.postgresql.org/docs/current/textsearch.html)
- [Prisma 全文搜索指南](https://www.prisma.io/docs/concepts/components/prisma-client/full-text-search)
- [Next.js 搜索最佳实践](https://nextjs.org/docs/app/building-your-application/data-fetching/patterns#search)
- Phase 6 Activity 全文搜索实现（`lib/repos/activity-repo.ts`）
- Phase 10 标签搜索实现（`lib/actions/tags.ts`）

---

_本文档作为 Phase
11 搜索功能实施的技术蓝图，所有开发活动必须严格遵循此设计进行。_
