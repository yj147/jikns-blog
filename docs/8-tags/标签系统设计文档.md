# Phase 10：标签系统设计文档

**版本**: v1.0  
**发布日期**: 2025-10-09  
**撰写人**: Linus 模式技术助手  
**关联阶段**: Phase 10（标签系统）

---

## 1. 背景 & 目标

### 1.1 背景

- Phase
  5-9 已完成博客文章、动态、评论、点赞收藏、关注等核心功能模块，内容生态已初步建立。
- 数据层已具备 `Tag` 和 `PostTag`
  多对多关联模型，文章创建/编辑流程已集成标签输入功能。
- `lib/repos/tag-repo.ts`
  已实现标签同步和计数逻辑，但缺少独立的标签管理界面和用户端展示功能。
- 当前标签管理分散在文章编辑流程中，缺乏统一的标签治理能力，容易产生重复标签和命名不规范问题。

### 1.2 目标

1. 交付完整的标签管理能力，支持管理员对标签进行 CRUD 操作，确保标签体系的规范性和一致性。
2. 提供用户端标签展示和筛选功能，包括标签云页面、标签详情页、按标签筛选文章等。
3. 增强文章编辑体验，提供标签自动补全和建议功能，减少重复标签的产生。
4. 建立标签使用统计和热门标签推荐机制，提升内容发现效率。

### 1.3 成功判定

- ✅ 管理员可在独立的标签管理页面查看、创建、编辑、删除标签。
- ✅ 用户可在标签云页面浏览所有标签，并按标签筛选文章。
- ✅ 标签详情页显示该标签下的所有文章列表，支持分页。
- ✅ 文章编辑时支持标签自动补全，减少重复标签的创建。
- ✅ 热门标签推荐功能在博客首页和文章详情页正常工作。
- ✅ 标签计数（postsCount）保持准确，与实际文章数量一致。

---

## 2. 范围界定

### 2.1 In Scope

- **后端**：标签 CRUD Server Actions、标签查询和搜索 API、热门标签推荐逻辑。
- **管理端**：`/admin/tags/` 标签管理页面、标签编辑对话框、批量操作功能。
- **用户端**：`/tags/` 标签云页面、`/tags/[slug]/` 标签详情页、标签筛选组件。
- **增强功能**：标签自动补全组件、热门标签推荐、标签搜索功能。
- **数据一致性**：标签删除时的级联处理、postsCount 计数同步。

### 2.2 Out of Scope

- 标签的高级特性（标签别名、标签层级关系、标签合并工具）。
- 标签的协作编辑和审核流程（多管理员场景）。
- 标签的使用趋势分析和可视化（Phase 11+ 搜索功能的一部分）。
- 标签的国际化和多语言支持。

---

## 3. 依赖 & 前置条件

| 类型      | 说明                                           | 状态                                      |
| --------- | ---------------------------------------------- | ----------------------------------------- |
| 数据模型  | `Tag` 和 `PostTag` 多对多关联模型              | ✅ 已存在 (`prisma/schema.prisma:90-115`) |
| 标签仓储  | `tag-repo.ts` 标签同步和计数逻辑               | ✅ 已实现 (`lib/repos/tag-repo.ts`)       |
| 认证抽象  | `requireAuth`, `requireAdmin`                  | ✅ Phase 2-4 完成                         |
| 文章系统  | 文章 CRUD 和标签关联                           | ✅ Phase 5 完成                           |
| UI 组件库 | shadcn/ui 基础组件                             | ✅ 已配置                                 |
| 响应规范  | `createSuccessResponse`, `createErrorResponse` | ✅ 架构收敛完成                           |

---

## 4. 架构总览

### 4.1 组件与交互

```
管理员操作 → 管理界面 `/admin/tags/` → Server Actions → Prisma Tag 表
                                      → 级联删除 PostTag 关联
                                      → 重新计算 postsCount

用户浏览 → 标签云 `/tags/` → 获取所有标签（按 postsCount 排序）
        → 标签详情 `/tags/[slug]/` → 获取该标签下的文章列表

文章编辑 → 标签自动补全组件 → 搜索现有标签 → 选择或创建新标签
                            → 调用 syncPostTags 同步关联

标签筛选 → 博客列表页 → 按标签过滤文章 → 显示筛选结果
```

### 4.2 服务分层

- **Server
  Actions 层**：`lib/actions/tags.ts`，负责标签 CRUD、查询、搜索等业务逻辑，包含权限验证和数据校验。
- **仓储层**：`lib/repos/tag-repo.ts`（已存在），封装标签同步和计数逻辑，保持数据一致性。
- **UI 层**：管理界面组件（`components/admin/tag-*.tsx`）和用户界面组件（`components/blog/tag-*.tsx`）。
- **页面层**：Next.js App Router 页面，负责数据获取和 SEO 优化。

---

## 5. 数据模型 & 索引策略

### 5.1 Prisma 模型回顾

```prisma
/// 标签模型 - 文章分类和检索
model Tag {
  id          String    @id @default(cuid())
  name        String    @unique
  slug        String    @unique
  description String?
  color       String?
  postsCount  Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  posts       PostTag[]

  @@index([postsCount(sort: Desc)])
  @@map("tags")
}

/// 文章标签关联表 - Post 和 Tag 的多对多关系
model PostTag {
  postId    String
  tagId     String
  createdAt DateTime @default(now())
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  tag       Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([postId, tagId])
  @@map("post_tags")
}
```

### 5.2 字段说明

- **name**: 标签名称，唯一约束，用于显示和搜索。
- **slug**: URL 友好的标识符，唯一约束，用于路由和 SEO。
- **description**: 标签描述（可选），用于标签详情页的说明。
- **color**: 标签颜色（可选），用于 UI 展示的视觉区分。
- **postsCount**: 冗余计数字段，记录该标签关联的文章数量，用于排序和热门推荐。
- **级联删除**: `onDelete: Cascade` 确保标签删除时自动删除 PostTag 关联记录。

### 5.3 索引利用

- **按文章数量排序**: `@@index([postsCount(sort: Desc)])` 支持热门标签查询。
- **唯一性约束**: `name` 和 `slug` 的唯一索引防止重复标签。
- **复合主键**: `PostTag` 的 `[postId, tagId]` 复合主键确保关联唯一性。

### 5.4 数据一致性保证

- **标签同步**: 通过 `syncPostTags`
  函数（`tag-repo.ts`）确保文章标签关联的原子性操作。
- **计数更新**: 通过 `recalculateTagCounts`
  函数在标签关联变更时重新计算 postsCount。
- **事务保护**: 所有涉及标签和关联的操作都在 Prisma 事务中执行，确保数据一致性。

### 5.5 用户 hashtag 候选池

普通用户在动态中使用 `#hashtag` 时，不再直接向 `tags`
主表写入数据；`syncActivityTags` 会执行以下步骤，确保管理员独占标签治理：

1. 删除该动态现有的标签关联。
2. 仅对已经存在于 `tags` 表的 slug 建立新的关联。
3. 将未知 slug 写入 `activity_tag_candidates`
   候选池，记录出现次数与最后一次触发的动态，用于后台审核。

```prisma
model ActivityTagCandidate {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  occurrences Int    @default(1)
  lastSeenAt DateTime @default(now())
  lastSeenActivity   Activity? @relation("ActivityTagCandidateLastSeen", fields: [lastSeenActivityId], references: [id], onDelete: SetNull)
  lastSeenActivityId String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lastSeenAt(sort: Desc)])
  @@map("activity_tag_candidates")
}
```

- **管理员审核流程**：运营可在后台查看候选池，挑选合规标签后再通过
  `/admin/tags/` 或文章编辑流程创建正式标签。
- **治理收益**：普通用户无法凭借 hashtag 污染标签空间，同时不会丢失热门词线索；候选池为后续自动化审批/统计提供数据基础。
- **后台界面**：`/admin/tags`
  中新增 “动态 hashtag 候选池” 区块，按出现次数排序展示候选词，并提供一键 Promote 按钮创建正式标签。

---

## 6. API 设计（Server Actions）

### 6.1 标签查询 API

#### `getTags(options)`

**功能**: 获取标签列表，支持分页、排序、搜索。

**参数**:

```typescript
interface GetTagsOptions {
  page?: number // 页码，默认 1
  limit?: number // 每页数量，默认 20
  orderBy?: "postsCount" | "name" | "createdAt" // 排序字段
  order?: "asc" | "desc" // 排序方向
  search?: string // 搜索关键词（匹配 name）
}
```

**返回**:

```typescript
ApiResponse<{
  tags: Array<{
    id: string
    name: string
    slug: string
    description: string | null
    color: string | null
    postsCount: number
    createdAt: Date
  }>
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}>
```

**权限**: 公开访问

---

#### `getTag(slugOrId)`

**功能**: 获取单个标签详情，包括关联的文章列表。

**参数**:

```typescript
slugOrId: string // 标签 slug 或 ID
```

**返回**:

```typescript
ApiResponse<{
  tag: {
    id: string
    name: string
    slug: string
    description: string | null
    color: string | null
    postsCount: number
    createdAt: Date
    updatedAt: Date
  }
}>
```

**权限**: 公开访问

---

#### `getPopularTags(limit)`

**功能**: 获取热门标签（按 postsCount 排序）。

**参数**:

```typescript
limit?: number  // 返回数量，默认 10
```

**返回**:

```typescript
ApiResponse<{
  tags: Array<{
    id: string
    name: string
    slug: string
    color: string | null
    postsCount: number
  }>
}>
```

**权限**: 公开访问

---

#### `searchTags(query)`

**功能**: 标签搜索和自动补全。

**参数**:

```typescript
query: string  // 搜索关键词
limit?: number // 返回数量，默认 10
```

**返回**:

```typescript
ApiResponse<{
  tags: Array<{
    id: string
    name: string
    slug: string
    postsCount: number
  }>
}>
```

**权限**: 公开访问

---

### 6.2 标签管理 API（仅管理员）

#### `createTag(data)`

**功能**: 创建新标签。

**参数**:

```typescript
interface CreateTagData {
  name: string // 标签名称（必填）
  description?: string // 标签描述（可选）
  color?: string // 标签颜色（可选）
}
```

**返回**:

```typescript
ApiResponse<{
  tag: {
    id: string
    name: string
    slug: string
    description: string | null
    color: string | null
  }
}>
```

**权限**: `requireAdmin()`

**验证规则**:

- name: 1-50 字符，不能为空
- name: 唯一性检查
- slug: 自动生成（使用 `normalizeTagSlug`）

---

#### `updateTag(tagId, data)`

**功能**: 更新标签信息。

**参数**:

```typescript
tagId: string
data: {
  name?: string
  description?: string
  color?: string
}
```

**返回**:

```typescript
ApiResponse<{
  tag: {
    id: string
    name: string
    slug: string
    description: string | null
    color: string | null
  }
}>
```

**权限**: `requireAdmin()`

**验证规则**:

- 至少提供一个字段
- name 更新时重新生成 slug
- name 唯一性检查（排除当前标签）

---

#### `deleteTag(tagId)`

**功能**: 删除标签（级联删除 PostTag 关联）。

**参数**:

```typescript
tagId: string
```

**返回**:

```typescript
ApiResponse<{
  message: string
}>
```

**权限**: `requireAdmin()`

**副作用**:

- 级联删除所有 PostTag 关联（由 Prisma schema 的 `onDelete: Cascade` 自动处理）
- 触发相关页面的 revalidation

---

## 7. 组件架构

### 7.1 管理端组件

#### `app/admin/tags/page.tsx`

**功能**: 标签管理列表页面

**组件结构**:

```
TagsManagementPage
├── PageHeader（标题 + 创建按钮）
├── SearchBar（搜索框）
├── TagsTable（标签列表表格）
│   ├── TableHeader（列标题：名称、slug、文章数、创建时间、操作）
│   └── TableRow（每行数据）
│       ├── TagName（标签名 + 颜色标识）
│       ├── PostsCount（文章数量）
│       ├── CreatedAt（创建时间）
│       └── Actions（编辑、删除按钮）
└── Pagination（分页组件）
```

**功能点**:

- 标签列表展示（表格形式）
- 搜索标签（实时过滤）
- 排序（按文章数量/创建时间）
- 创建新标签（打开对话框）
- 编辑标签（打开对话框）
- 删除标签（确认对话框）

---

#### `components/admin/tag-dialog.tsx`

**功能**: 标签创建/编辑对话框

**表单字段**:

- 标签名称（必填，自动生成 slug）
- 标签描述（可选，多行文本）
- 标签颜色（可选，颜色选择器）

**验证规则**:

- 名称：1-50 字符
- 名称：唯一性检查（实时验证）
- slug：自动生成，只读显示

**模式**:

- 创建模式：空表单
- 编辑模式：预填充现有数据

---

### 7.2 用户端组件

#### `app/tags/page.tsx`

**功能**: 标签云页面

**组件结构**:

```
TagsCloudPage
├── PageHeader（标题 + 描述）
├── SearchBar（标签搜索）
├── TagsGrid（标签网格）
│   └── TagCard（标签卡片）
│       ├── TagName（标签名）
│       ├── PostsCount（文章数量）
│       └── ColorIndicator（颜色标识）
└── EmptyState（无标签时的空状态）
```

**功能点**:

- 显示所有标签（按文章数量排序）
- 标签搜索（实时过滤）
- 点击标签跳转到标签详情页
- 响应式布局（网格自适应）

---

#### `app/tags/[slug]/page.tsx`

**功能**: 标签详情页

**组件结构**:

```
TagDetailPage
├── TagHeader（标签信息）
│   ├── TagName（标签名 + 颜色）
│   ├── Description（标签描述）
│   └── PostsCount（文章数量）
├── PostsList（文章列表）
│   └── PostCard（文章卡片）
└── Pagination（分页组件）
```

**功能点**:

- 显示标签基本信息
- 显示该标签下的所有已发布文章
- 文章列表分页
- SEO 优化（动态 meta 标签）

---

#### `components/blog/tag-filter.tsx`

**功能**: 标签筛选组件（用于博客列表页）

**组件结构**:

```
TagFilter
├── FilterHeader（筛选标题）
├── PopularTags（热门标签）
│   └── TagBadge（标签徽章，可点击）
└── ClearButton（清除筛选按钮）
```

**功能点**:

- 显示热门标签（前 10 个）
- 支持多标签筛选（AND 逻辑）
- 标签选中状态视觉反馈
- 清除所有筛选

---

### 7.3 增强组件

#### `components/admin/tag-autocomplete.tsx`

**功能**: 标签自动补全组件（用于文章编辑）

**组件结构**:

```
TagAutocomplete
├── Input（输入框）
├── Dropdown（下拉建议列表）
│   ├── ExistingTags（现有标签列表）
│   └── CreateNewTag（创建新标签选项）
└── SelectedTags（已选标签列表）
    └── TagBadge（标签徽章 + 删除按钮）
```

**功能点**:

- 输入时实时搜索现有标签
- 显示匹配的标签建议
- 支持选择已有标签或创建新标签
- 防止重复标签
- 键盘导航支持（上下键选择，回车确认）

---

## 8. 权限控制策略

### 8.1 权限分级

- **公开访问**: 标签查询、标签详情、热门标签、标签搜索
- **管理员专用**: 标签创建、编辑、删除

### 8.2 权限验证点

- **Server Actions**: 所有写操作（create/update/delete）必须调用
  `requireAdmin()`
- **管理页面**: `/admin/tags/` 路由通过 middleware 或 layout 验证管理员权限
- **API 响应**: 权限不足时返回 `PERMISSION_DENIED` 错误码

### 8.3 数据访问控制

- **标签查询**: 所有用户可查询所有标签
- **标签编辑**: 仅管理员可编辑任何标签
- **标签删除**: 仅管理员可删除标签，删除前需确认（防止误删）

---

## 9. 性能优化方案

### 9.1 数据库查询优化

- **利用索引**: 热门标签查询使用 `postsCount` 降序索引
- **分页查询**: 使用 `skip` 和 `take` 进行分页，避免一次性加载所有数据
- **字段选择**: 列表查询只选择必要字段，减少数据传输量

### 9.2 缓存策略

- **标签列表**: 使用 Next.js 的 `revalidate` 机制，缓存 5 分钟
- **热门标签**: 缓存 10 分钟，减少数据库查询
- **标签详情**: 使用 `revalidatePath` 在标签更新时主动失效缓存

### 9.3 冗余字段优化

- **postsCount**: 避免每次查询都 COUNT，使用冗余字段提升性能
- **计数同步**: 通过 `recalculateTagCounts` 确保计数准确性
- **事务保护**: 标签关联变更和计数更新在同一事务中执行

---

## 10. 与现有模块的集成点

### 10.1 文章管理模块

- **集成位置**: `components/admin/post-form.tsx`
- **集成方式**: 替换现有的简单标签输入为 `TagAutocomplete` 组件
- **数据同步**: 文章保存时调用 `syncPostTags` 同步标签关联

### 10.2 博客列表页

- **集成位置**: `app/blog/page.tsx`
- **集成方式**: 添加 `TagFilter` 组件，支持按标签筛选
- **URL 参数**: 使用 `?tag=slug` 参数传递筛选条件

### 10.3 文章详情页

- **集成位置**: `app/blog/[slug]/page.tsx`
- **集成方式**: 显示文章的标签列表，点击标签跳转到标签详情页
- **侧边栏**: 显示热门标签推荐

---

## 11. 错误处理与边界情况

### 11.1 错误场景

- **标签不存在**: 返回 `NOT_FOUND` 错误
- **标签名重复**: 返回 `DUPLICATE_ENTRY` 错误
- **权限不足**: 返回 `PERMISSION_DENIED` 错误
- **参数无效**: 返回 `VALIDATION_ERROR` 错误

### 11.2 边界情况

- **空标签列表**: 显示友好的空状态提示
- **标签无文章**: 标签详情页显示"暂无文章"提示
- **标签名过长**: 前端截断显示，后端验证长度
- **特殊字符**: slug 生成时自动处理特殊字符

---

## 12. 测试策略

### 12.1 单元测试

- **Server Actions**: 测试所有 CRUD 操作和查询逻辑
- **tag-repo**: 测试标签同步和计数逻辑
- **组件**: 测试关键组件的渲染和交互

### 12.2 集成测试

- **标签 CRUD 流程**: 创建 → 编辑 → 删除
- **标签与文章关联**: 文章创建时添加标签 → 标签计数更新
- **标签筛选**: 按标签筛选文章 → 返回正确结果

### 12.3 E2E 测试

- **管理员流程**: 登录 → 创建标签 → 编辑标签 → 删除标签
- **用户流程**: 浏览标签云 → 点击标签 → 查看文章列表
- **文章编辑**: 添加标签 → 自动补全 → 保存文章

---

## 13. 上线检查清单

- [ ] 所有 Server Actions 通过单元测试
- [ ] 管理界面功能完整且无明显 bug
- [ ] 用户界面响应式布局正常
- [ ] 标签计数准确性验证通过
- [ ] 权限控制测试通过
- [ ] 性能测试达标（查询响应时间 < 500ms）
- [ ] TypeScript 编译无错误
- [ ] ESLint 和 Prettier 检查通过
- [ ] 文档更新完成（API 文档、使用指南）

---

_本文档作为 Phase
10 标签系统实施的技术设计基准，所有开发活动必须严格遵循此设计进行。_
