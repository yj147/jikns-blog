# 数据库迁移说明

## 本地开发环境

### 当前状态

本地 Supabase 实例使用 **simple** 配置的全文搜索（基于应用层分词）：

- ✅ `posts.search_vector` - 使用 `to_tsvector('simple', titleTokens || ...)`
- ✅ `activities.search_vector` - 使用 `to_tsvector('simple', contentTokens)`
- ✅ GIN 索引已创建
- ✅ token 列由 Prisma middleware 自动维护（nodejieba 分词）

### 相关迁移

1. `20251108102000_drop_search_vector_for_rebuild.sql` - 删除旧的 search_vector 列
2. `20251108102100_rebuild_search_vector_english.sql` - 临时使用 english 配置（已被下一个迁移替换）
3. `20251108120000_add_search_tokens.sql` - 添加 token 列并使用 simple 配置重建

### 优势

- ✅ **中文支持良好**：nodejieba 应用层分词，适配中英文混合内容
- ✅ **无需数据库扩展**：适用于 Supabase 托管环境
- ✅ **灵活可控**：可随时切换分词算法，无需数据库迁移

### 应用层分词工作流

最新的迁移（`20251108120000_add_search_tokens.sql`）为 posts/activities 增加了 token 列：

1. 执行 Supabase 迁移，自动创建
   `titleTokens / excerptTokens / seoDescriptionTokens / contentTokens`
   等列，并重建 `search_vector`。
2. 运行 `pnpm search:tokens:backfill`，调用 `nodejieba`
   批量生成历史数据的 token。
3. 确认 `posts.search_vector` 与 `activities.search_vector`
   的 GENERATED 列均指向 token 字段。

> 说明：Prisma 中的写入/更新流程已通过 middleware 自动维护 token 列，无需额外改动。

---

## 生产部署流程

默认方案完全基于“应用层分词 +
`to_tsvector('simple', tokens)`”，与本地 Supabase 环境一致。部署步骤：

1. **运行数据库迁移**  
   `pnpm db:migrate`（或 `supabase db push`）会创建 token 列并重建
   `search_vector`。
2. **回填历史 token（如存在存量数据）**  
   `pnpm search:tokens:backfill` 会调用 nodejieba 对既有文章/动态重新分词。
3. **验证 GENERATED 列与索引**  
   使用 `\d posts` / `\d activities` 确认 `search_vector`
   指向 token 列，`idx_*_search_vector` (GIN) 存在。
4. **回归测试**  
   至少运行 `pnpm exec tsc --noEmit` 和搜索相关 test
   suites，确保 middleware、降级分支正常。

> 以上流程同样适用于 staging / 生产环境，不依赖任何数据库扩展。

### 自托管 Postgres（可选）

若未来迁移到自托管 PostgreSQL，并希望改用数据库端分词，可在自建集群中安装 zhparser，然后执行
`.20251108101500_enable_zh_fulltext.sql.production_only` 迁移。  
在 Supabase 托管环境中，此步骤不是必需项，也无需修改代码配置。

### 外部搜索服务（可选）

当数据量或搜索特性超出 PostgreSQL 全文搜索能力时，可按以下步骤升级到 Meilisearch
/ Typesense 等托管服务：

1. **数据同步**：在写入 Post/Activity 时同时向搜索服务写入文档（token 字段可直接复用）。
2. **查询适配**：在 `lib/repos/search/*`
   中切换搜索实现，保持同样的接口（searchPosts/searchActivities/...）。
3. **回表补全**：搜索服务返回 ID 后，仍在数据库中补全作者 / 标签等关联信息。
4. **灰度切换**：可在 env 或 feature
   flag 中控制走 PostgreSQL 还是外部搜索，逐步验证性能。

这样即使未来替换搜索引擎，也无需调整前端或 Server Action 契约。

---

## 回滚方案

如果应用层分词出现问题，可以临时回退到 simple 配置（不依赖 token 列）：

```sql
-- 重建 search_vector 直接使用原始内容
ALTER TABLE public.posts
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE public.posts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("seoDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C')
  ) STORED;

-- 重建索引
CREATE INDEX idx_posts_search_vector ON public.posts USING GIN (search_vector);
```

> 注意：此回退方案会失去 nodejieba 分词的优势，中文搜索效果会下降。

---

## 注意事项

1. **默认策略**：所有环境都依赖应用层 token +
   `to_tsvector('simple', tokens)`，无需任何扩展。
2. **自托可选**：只有在自建 PostgreSQL 并确认可控时，才考虑启用 zhparser 作为替代方案。
3. **迁移顺序**：
   - 本地：`20251108102000` → `20251108102100` → `20251108120000`
   - 生产：直接同步到最新迁移即可
4. **数据迁移**：`search_vector` 为 GENERATED
   ALWAYS，正常写入会自动更新；历史数据需运行回填脚本。
5. **性能影响**：重建 GIN 索引可能需要几分钟，建议在低峰期执行。

---

## 常见问题

### Q: 为什么不直接依赖 zhparser？

A: 当前架构把分词放在应用层（nodejieba），对托管 Supabase、无扩展环境更友好，也便于后续更换分词方案。

### Q: simple 配置与 english 配置的区别？

A:

- **simple 配置**：不做任何语言特定处理，直接按空格分割 token。适合已经分词的内容（如我们的 token 列）。
- **english 配置**：会进行词干提取（stemming）、停用词过滤等英文特定处理，不适合中文内容。

我们使用 `to_tsvector('simple', tokens)`
是因为 token 列已经由 nodejieba 完成分词，无需数据库再做额外处理。

### Q: 还需要安装 zhparser 吗？

A: 只有在迁移到自托管 PostgreSQL 并希望由数据库负责分词时，才需要 zhparser。对 Supabase
Cloud 环境而言，并非必需。
