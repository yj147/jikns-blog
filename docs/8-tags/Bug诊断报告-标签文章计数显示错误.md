# Bug 诊断报告：标签文章计数显示错误（已解决）

**Bug ID**: TAG-BUG-002 **报告时间**: 2025-10-09
**类型**: 用户误解 + 数据重复问题 **严重程度**: 🟢 低（数据正确，但有重复文章）
**影响范围**: 标签系统 **状态**: ✅ 已诊断，提供清理方案

---

## 问题描述

### 用户报告的症状

用户报告标签系统的文章计数显示不正确：

- **数据库状态**: 有 2 个标签（`react` 和 `nextjs`）
- **用户认为**: 每个标签只关联了 1 篇文章
- **显示问题**: 每个标签下面都显示 "2 篇文章"

### 实际诊断结果

**运行诊断脚本后发现**：

```
✅ 标签: nextjs (slug: nextjs)
   数据库 postsCount: 2
   实际 PostTag 记录数: 2
   关联的文章:
     1. Next.js 全栈开发实战指南 (ID: cmgj04z020001jxh6ay7fq30r, 已发布: 否)
     2. Next.js 全栈开发实战指南 (ID: cmgj053e00005jxh63pw3vbra, 已发布: 是)

✅ 标签: react (slug: react)
   数据库 postsCount: 2
   实际 PostTag 记录数: 2
   关联的文章:
     1. Next.js 全栈开发实战指南 (ID: cmgj04z020001jxh6ay7fq30r, 已发布: 否)
     2. Next.js 全栈开发实战指南 (ID: cmgj053e00005jxh63pw3vbra, 已发布: 是)
```

**真实情况**：

- ✅ 数据库中确实有 **2 篇文章**（标题相同，但 ID 不同）
- ✅ 每个标签都关联了这 **2 篇文章**
- ✅ 标签计数显示 "2 篇文章" 是 **正确的**
- ❌ 问题：有 **重复的文章**（一篇未发布，一篇已发布）

### 用户误解的原因

用户可能只看到了**已发布**的文章（1 篇），忽略了**未发布**的文章（1 篇），因此认为只有 1 篇文章。

---

## 诊断过程

### 1. 数据库结构分析

**Tag 表结构**（`prisma/schema.prisma`）：

```prisma
model Tag {
  id          String    @id @default(cuid())
  name        String    @unique
  slug        String    @unique
  description String?
  color       String?
  postsCount  Int       @default(0)  // 文章计数字段
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  posts       PostTag[]

  @@index([postsCount(sort: Desc)])
  @@map("tags")
}
```

**PostTag 关联表结构**：

```prisma
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

### 2. 标签计数更新逻辑分析

**核心函数**：`recalculateTagCounts`（`lib/repos/tag-repo.ts`）

```typescript
export async function recalculateTagCounts(
  tx: Transaction,
  tagIds: string[]
): Promise<void> {
  if (!tagIds || tagIds.length === 0) return

  const uniqueTagIds = Array.from(new Set(tagIds))

  await Promise.all(
    uniqueTagIds.map(async (tagId) => {
      const count = await tx.postTag.count({ where: { tagId } })
      await tx.tag.update({
        where: { id: tagId },
        data: { postsCount: Math.max(count, 0) },
      })
    })
  )
}
```

**逻辑分析**：

- ✅ 函数逻辑正确：统计 PostTag 表中每个 tagId 的记录数
- ✅ 使用 `Math.max(count, 0)` 确保计数不为负数
- ✅ 使用 `Set` 去重，避免重复更新

### 3. 调用场景分析

**场景 1：创建文章**（`lib/actions/posts.ts` - `createPost`）

```typescript
if (Array.isArray(data.tagNames)) {
  await syncPostTags({
    tx,
    postId: post.id,
    newTagNames: data.tagNames,
  })
}
```

**场景 2：更新文章**（`lib/actions/posts.ts` - `updatePost`）

```typescript
if (updateData.tagNames !== undefined) {
  await syncPostTags({
    tx,
    postId: id,
    newTagNames: updateData.tagNames,
    existingPostTags: existingPostTagsSnapshot,
  })
}
```

**场景 3：删除文章**（`lib/actions/posts.ts` - `deletePost`）

```typescript
await prisma.$transaction(async (tx) => {
  await tx.post.delete({
    where: { id: postId },
  })

  const affectedTagIds = existingPost.tags.map((postTag) => postTag.tagId)
  if (affectedTagIds.length > 0) {
    await recalculateTagCounts(tx, affectedTagIds)
  }
})
```

**逻辑分析**：

- ✅ 创建文章时调用 `syncPostTags`，会自动更新标签计数
- ✅ 更新文章时调用 `syncPostTags`，会自动更新标签计数
- ✅ 删除文章时调用 `recalculateTagCounts`，会重新计算标签计数
- ✅ 所有操作都在事务中执行，确保数据一致性

### 4. 可能的原因分析

#### 原因 1：数据库中 `postsCount` 字段与实际不符

**可能性**: 🔴 高

**分析**：

- Tag 表的 `postsCount` 字段可能因为某些原因没有正确更新
- 例如：
  - 直接在数据库中修改了 PostTag 表，但没有更新 Tag 表
  - 在事务外部操作了数据，导致计数不一致
  - 代码逻辑在某些边界情况下有 bug

#### 原因 2：PostTag 表中有重复记录

**可能性**: 🟡 中

**分析**：

- PostTag 表的主键是 `[postId, tagId]` 的复合主键
- 理论上不应该有重复记录
- 但如果数据库约束失效或被绕过，可能会有重复

#### 原因 3：显示层面的计算错误

**可能性**: 🟢 低

**分析**：

- 标签列表页面应该直接读取 `postsCount` 字段
- 不太可能有前端计算逻辑导致显示错误

#### 原因 4：历史数据遗留问题

**可能性**: 🔴 高

**分析**：

- 用户可能在标签计数功能完善之前创建了文章
- 或者在开发过程中手动修改了数据库
- 导致 `postsCount` 字段与实际不符

---

## 根本原因

**真实原因**：**数据库中有重复的文章** + **用户只看到已发布的文章**

**实际情况**：

1. 数据库中有 2 篇标题相同的文章："Next.js 全栈开发实战指南"
   - 文章 1：ID `cmgj04z020001jxh6ay7fq30r`，**未发布**
   - 文章 2：ID `cmgj053e00005jxh63pw3vbra`，**已发布**
2. 两篇文章都有 `react` 和 `nextjs` 标签
3. 因此每个标签的 `postsCount` 都是 2（正确）
4. 用户可能只在前端看到已发布的文章（1 篇），因此认为只有 1 篇文章
5. 但数据库中确实有 2 篇文章，所以计数显示 "2 篇文章" 是**正确的**

**结论**：

- ✅ 标签计数逻辑**完全正确**
- ✅ 数据库数据**一致性正常**
- ❌ 问题是有**重复的文章**（可能是用户误操作创建的）

---

## 解决方案

### 方案 1：清理重复的文章（推荐）

**问题**：数据库中有重复的文章（标题相同，但 ID 不同）

**解决步骤**：

1. **运行诊断脚本**，确认重复的文章：

   ```bash
   npx tsx scripts/check-tag-counts.ts
   ```

2. **运行清理脚本**，删除重复的文章：

   ```bash
   npx tsx scripts/clean-duplicate-posts.ts
   ```

   脚本会自动：
   - 找出所有重复的文章（标题相同）
   - 保留已发布的文章
   - 删除未发布的重复文章
   - 自动更新标签计数

3. **验证清理结果**：
   - 检查标签列表页面，确认计数显示正确
   - 再次运行诊断脚本，确认没有重复文章

**优点**：

- ✅ 彻底解决问题，删除重复数据
- ✅ 自动更新标签计数
- ✅ 保留已发布的文章，删除未发布的重复文章

**缺点**：

- ⚠️ 会删除数据，需要确认后再执行

### 方案 2：手动删除重复文章

**如果不想运行脚本**，可以手动删除：

1. 在管理后台找到重复的文章
2. 删除未发布的文章（ID: `cmgj04z020001jxh6ay7fq30r`）
3. 保留已发布的文章（ID: `cmgj053e00005jxh63pw3vbra`）
4. 标签计数会自动更新

**优点**：

- ✅ 可以手动确认要删除的文章
- ✅ 更安全，不会误删

**缺点**：

- ❌ 需要手动操作
- ❌ 如果有多组重复文章，操作繁琐

### 方案 3：只统计已发布的文章（不推荐）

**如果希望标签计数只统计已发布的文章**：

修改 `recalculateTagCounts` 函数：

```typescript
const count = await tx.postTag.count({
  where: {
    tagId,
    post: { published: true }, // 只统计已发布的文章
  },
})
```

**优点**：

- ✅ 标签计数只显示已发布的文章数量

**缺点**：

- ❌ 改变了原有的业务逻辑
- ❌ 未发布的文章也应该被统计（草稿也是文章）
- ❌ 不解决重复文章的问题

---

## 推荐执行步骤

### 立即执行（清理重复数据）

1. **运行诊断脚本**，确认重复的文章：

   ```bash
   npx tsx scripts/check-tag-counts.ts
   ```

2. **运行清理脚本**，删除重复的文章：

   ```bash
   npx tsx scripts/clean-duplicate-posts.ts
   ```

3. **验证清理结果**：
   - 访问标签列表页面，确认计数显示正确
   - 访问博客列表页面，确认没有重复文章
   - 再次运行诊断脚本，确认数据正确

### 后续优化（防止未来问题）

1. **添加唯一性约束**（可选）：
   - 在 Post 表的 `slug` 字段上已有唯一约束
   - 确保不会创建 slug 相同的文章

2. **改进文章创建流程**：
   - 在创建文章前，检查是否已存在相同标题的文章
   - 提示用户是否要编辑现有文章而不是创建新文章

3. **添加数据一致性检查**：
   - 在管理后台添加"数据一致性检查"功能
   - 定期运行检查，发现重复文章及时提醒

---

## 预防措施

### 1. 代码审查清单

在代码审查时，必须检查：

- [ ] 所有修改 PostTag 表的操作，是否调用了 `recalculateTagCounts`
- [ ] 所有事务操作，是否正确处理了标签计数更新
- [ ] 是否有直接修改数据库的操作，绕过了应用层逻辑

### 2. 测试覆盖

确保以下场景都有测试覆盖：

- [ ] 创建文章时，标签计数正确更新
- [ ] 更新文章标签时，标签计数正确更新
- [ ] 删除文章时，标签计数正确更新
- [ ] 批量删除文章时，标签计数正确更新
- [ ] 边界情况：文章没有标签、文章有多个标签、多篇文章共享标签

### 3. 数据库操作规范

- ❌ 禁止直接在数据库中修改 PostTag 表
- ❌ 禁止直接在数据库中修改 Tag 表的 `postsCount` 字段
- ✅ 所有数据修改必须通过应用层 API 或 Server Actions
- ✅ 如果必须直接修改数据库，修改后必须运行数据修复脚本

---

## 总结

**问题**: 用户认为标签文章计数显示不正确（显示 2，用户认为应该是 1）

**真实原因**:

- ✅ 标签计数逻辑**完全正确**
- ✅ 数据库中确实有 **2 篇文章**（标题相同，但 ID 不同）
- ❌ 问题是有**重复的文章**（一篇未发布，一篇已发布）
- 用户可能只看到已发布的文章，因此认为只有 1 篇

**解决方案**: 清理重复的文章

**执行步骤**:

1. 运行 `npx tsx scripts/check-tag-counts.ts` 确认重复文章
2. 运行 `npx tsx scripts/clean-duplicate-posts.ts` 清理重复文章
3. 验证清理结果

**产出物**:

1. ✅ 诊断脚本：`scripts/check-tag-counts.ts`
2. ✅ 修复脚本：`scripts/fix-tag-counts.ts`（重新计算标签计数）
3. ✅ 清理脚本：`scripts/clean-duplicate-posts.ts`（删除重复文章）
4. ✅ 诊断报告：`docs/8-tags/Bug诊断报告-标签文章计数显示错误.md`

**预防措施**:

1. 在创建文章前，检查是否已存在相同标题的文章
2. 添加数据一致性检查功能
3. 定期运行检查，发现重复文章及时提醒

**后续优化**:

1. 改进文章创建流程，防止创建重复文章
2. 在管理后台添加"数据一致性检查"功能
3. 添加唯一性约束或警告提示

---

_报告生成时间: 2025-10-09_  
_诊断人员: Claude (Linus 模式)_  
_审查状态: ✅ 已完成诊断，待执行修复_
