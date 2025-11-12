# 评论系统 Stage A 完成报告（服务层硬化）

**版本**: 1.0  
**日期**: 2025-09-11  
**模块**: 评论系统（Phase 7 / Stage A）  
**原则**: Never break userspace / 简化优先 / 兼容迁移

---

## 1. 执行范围与目标

- A1 校验与清理：统一输入/输出契约、XSS 清理前置、软删/硬删策略与 Schema 对齐。
- A2 计数策略核对：Activity 侧冗余计数增减；Post 侧聚合计数，不引入未定义字段。
- A3 单元测试（设计与计划）：列出覆盖点与用例清单，纳入后续提交计划。

---

## 2. 变更摘要（与代码路径）

- 服务层
  - 更新 `@/lib/interactions/comments.ts`
    - 写入前统一 `cleanXSS`
    - 删除：存在子回复→软删（仅置内容为“[该评论已删除]”）；无子回复→硬删
    - 计数：仅对 Activity 目标更新 `commentsCount +=/-= 1`；Post 侧不维护冗余
    - 列表：支持 `cursor=id` 游标与 `includeReplies`
- 路由与兼容
  - 新增 `app/api/comments/[id]/route.ts`（DELETE 动态路由）
  - 新增
    `app/api/activities/[id]/comments/[commentId]/route.ts`（兼容层 DELETE 动态路由）
  - 更新 `app/api/comments/route.ts`（保留 GET/POST，移出 DELETE）
  - 更新
    `app/api/activities/[id]/comments/route.ts`（保留 GET/POST，移出 DELETE）
- 旁路影响（一致性）
  - 点赞服务修正（仅记录以供审计）：`@/lib/interactions/likes.ts` 对齐
    `authorId/author` 并取消 Post 冗余计数写入（不影响评论模块功能）

---

## 3. 不破坏性说明（兼容性）

- 旧端点保留：`/api/activities/[id]/comments` 仍可用（薄封装转调统一服务）。
- 统一端点： `/api/comments`（GET/POST）与
  `/api/comments/[id]`（DELETE）按设计契约工作。
- Schema 未新增/删除字段；仅移除对不存在字段的写入（如 `Comment.deletedAt`）。

---

## 4. 验证与结果

- 类型检查：`pnpm type-check`（通过）
- 手动验收（本地）
  - 创建评论：POST `/api/comments`（post/activity 两种目标）→ 201/200 成功
  - 列表评论：GET `/api/comments?targetType=activity&targetId=...&limit=10`
    → 返回分页与 `nextCursor`
  - 删除评论：DELETE `/api/comments/[id]`（作者/ADMIN）→ `deleted: true`
  - 兼容路由：GET/POST/DELETE `/api/activities/[id]/comments*`
    行为与统一路由一致
- 注意：软删时仅内容置空提示，不减少计数；硬删减少计数（Activity）。

---

## 5. 单元测试（A3）

- 状态：用例清单与覆盖点已明确，测试文件路径预留
  `tests/lib/interactions/comments.test.ts`
- 覆盖点（计划）：
  - createComment：目标不存在 / XSS 清理 / 父评论校验 / Activity 计数 +1
  - listComments：cursor 分页 / includeReplies / includeAuthor 选择
  - deleteComment：作者/ADMIN 权限 / 软删与硬删分支 / Activity 计数 -1（硬删）
- 说明：为避免本批 PR 体量过大，单测将在紧随的 Stage
  B 之前单独提交合并（不影响现有功能）。

---

## 6. 风险与回退

- 风险：软删/硬删计数不一致 → 已限定仅硬删影响计数，软删不影响计数。
- 回退：保留兼容端点；统一服务为替换层，出现异常可临时回退至 activity 旧端点调用。

---

## 7. 后续工作（进入 Stage B 前的准备）

- 提交评论服务单元测试，确保关键行为断言到位。
- 前端通用评论组件骨架与注入方案评审（进入 Stage C）。
- 如需，补充 `comment-limits` 速率限制骨架（可在 Stage D 执行）。

---

## 8. 结论

- A1/A2 已完成并通过手动验收，行为与契约对齐设计文档；
- A3 已完成用例设计与执行计划（测试代码将紧随提交）；
- 满足进入下一阶段（Stage B/C）的条件，不破坏现有行为。
