# P8-BE-4 兼容入口委托（单模块）- 完成报告

## 摘要

本任务成功实现了历史互动 API 入口的内部重构，将点赞和收藏功能委托到统一服务层，同时保持对外行为和响应格式完全不变。实现了"Never
break userspace"的核心原则，为后续系统迁移和优化奠定基础。

## 改动清单

### 1. 修改的文件

#### `/app/api/user/interactions/route.ts`

- **点赞分支委托**：内部调用 `toggleLike` 服务，映射响应格式
  - 使用 `result.isLiked` 判断 liked/unliked 分支
  - 保留原有 `action: "liked/unliked"` 字段格式
  - 保留原有 `likeCount` 字段名称（直接使用 `result.count`）
  - 当 `isLiked === true` 时，通过 `findFirst` 查询获取 `likeId`
  - 保留原有错误码和消息
- **收藏分支委托**：内部调用 `toggleBookmark` 服务，映射响应格式
  - 使用 `result.isBookmarked` 判断 bookmarked/unbookmarked 分支
  - 保留原有 `action: "bookmarked/unbookmarked"` 字段格式
  - 保留原有 `bookmarkCount` 字段名称（直接使用 `result.count`）
  - 当 `isBookmarked === true` 时，通过 `findUnique` 查询获取 `bookmarkId`
  - 保留原有文章信息结构 `post: { id, title }`
- **关注分支**：保持原有逻辑不变
- **添加 @deprecated 注释**：明确标记为历史兼容入口，指向新路由

#### `/app/actions/post-actions.ts`

- **`likePost` 函数**：委托到 `toggleLike` 服务
  - 映射 `result.isLiked` 到 `data.liked`
  - 保持原有的响应结构 `{ success, data: { liked }, message }`
  - 保持原有的消息文本
- **`bookmarkPost` 函数**：委托到 `toggleBookmark` 服务
  - 使用 `result.isBookmarked` 判断状态
  - 特殊处理：只在确实添加收藏时返回成功
  - 保持原有错误消息："您已经收藏过这篇文章"
- **`unbookmarkPost` 函数**：委托到 `toggleBookmark` 服务
  - 使用 `result.isBookmarked` 判断状态
  - 特殊处理：只在确实取消收藏时返回成功
  - 保持原有错误消息："您尚未收藏这篇文章"

### 2. 新增的测试

#### `/tests/api/user-interactions-compat.test.ts`

完整的兼容性测试套件，验证：

- 点赞功能：文章和动态的点赞/取消点赞
- 收藏功能：文章的收藏/取消收藏
- 关注功能：冒烟测试确保不受影响
- 错误处理：参数缺失、目标不存在、不支持的类型等
- **Mock 对齐**：测试 mock 已对齐真实服务层返回格式（`isLiked`/`isBookmarked`）
- **ID 查询补充**：在新增成功时，mock 额外的 ID 查询以保持旧契约

## 对外契约一致性说明

### 响应格式完全兼容

1. **成功响应结构**

```json
{
  "success": true,
  "data": {
    "action": "liked/unliked/bookmarked/unbookmarked/followed/unfollowed",
    "likeCount": 10, // 点赞时
    "bookmarkCount": 5, // 收藏时
    "followerCount": 100, // 关注时
    "targetType": "POST", // 点赞时
    "targetId": "xxx" // 点赞时
  }
}
```

2. **错误响应结构**

```json
{
  "success": false,
  "error": "错误消息",
  "code": "ERROR_CODE"
}
```

### 行为语义保持一致

- 点赞切换：toggle 语义，已点赞则取消，未点赞则添加
- 收藏单向：`bookmarkPost` 只能添加，`unbookmarkPost` 只能删除
- 错误处理：所有错误码、消息文本、HTTP 状态码保持不变

## 测试统计

### 测试覆盖范围

- 点赞功能：4 个测试用例 ✅
- 收藏功能：3 个测试用例 ✅
- 关注功能：1 个冒烟测试 ✅
- 错误处理：3 个测试用例 ✅
- **总计**：11 个测试用例，**全部通过**

### 关键验证点

- ✅ 响应字段名称完全一致
- ✅ 字段值格式完全一致（如 `action: "liked"` 而非 `action: "like"`）
- ✅ 错误码和消息文本完全一致
- ✅ HTTP 状态码完全一致
- ✅ 关注功能不受影响

## 风险与后续建议

### 当前风险

1. **双重维护成本**：新旧两套路由并存，需要同时维护
2. **测试复杂度**：需要同时测试新路由和兼容路由
3. **文档混淆**：需要明确告知开发者使用新路由

### 后续建议

#### 短期（1-2 周）

1. 监控历史路由使用情况，收集调用频率数据
2. 在开发文档中标记历史路由为 deprecated
3. 新功能开发统一使用新路由

#### 中期（1-2 月）

1. 通知前端团队迁移到新路由
2. 提供迁移指南和自动化工具
3. 设置历史路由调用告警

#### 长期（3-6 月）

1. 评估历史路由使用情况
2. 制定废弃计划和时间表
3. 提供充足的迁移缓冲期

## 关键修复

### 契约映射修复

- **服务层返回格式**：统一服务层返回 `isLiked`/`isBookmarked`，而非
  `liked`/`bookmarked`
- **字段映射实现**：兼容路由正确映射 `isLiked` → `action: "liked/unliked"`
- **ID 字段补充**：在新增成功时通过额外查询获取
  `likeId`/`bookmarkId`，保持旧契约完整
- **重复查询消除**：直接使用服务层返回的 `count`，避免重复查询

## 结论

本次重构成功实现了以下目标：

1. ✅ 内部架构优化：点赞/收藏功能委托到统一服务层
2. ✅ 对外契约不变：响应格式、错误处理完全兼容，包括所有字段
3. ✅ 渐进式迁移：新旧路由并存，平滑过渡
4. ✅ 质量保证：完整的兼容性测试覆盖
5. ✅ 性能优化：消除了冗余的 count 查询

符合 "Never break
userspace" 的架构演进原则，为后续的系统优化和功能扩展打下良好基础。

---

_完成时间：2025-01-15_  
_执行人：Claude Assistant_  
_修复时间：2025-01-15（修正契约映射问题）_  
_验收状态：已完成_
