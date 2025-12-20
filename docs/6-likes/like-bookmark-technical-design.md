# 点赞与收藏系统 - 技术设计文档（Phase 8）

> 模式：Linus 审查风格。目标是以最小复杂度实现稳定、可维护、向后兼容的点赞与收藏系统，不引入不必要的层与魔法。

## 1. 目标与范围

- 统一实现点赞（Like）与收藏（Bookmark）能力：
  - 点赞目标：Post、Activity。
  - 收藏目标：Post（仅文章侧，符合需求文档）。
- 统一服务层（lib/interactions/\*）与统一 API 契约（/api/likes,
  /api/bookmarks）。
- 保持与历史入口兼容（/api/user/interactions + Server Actions），Never break
  userspace。
- 安全：认证授权、限流、输入校验；性能：索引、计数策略；可观测：统一日志。

不做事项：

- 不引入额外中间层或事件总线；不改变现有 Prisma
  schema；不批量迁移旧 API，仅做委托与弃用标记。

## 2. 现状与数据模型

- 现有模型（已在 Prisma 中）：
  - Like：authorId + postId/activityId（多态），唯一约束防重复（@@unique）。
  - Bookmark：userId + postId，唯一约束防重复（@@unique）。
- 计数策略：
  - Activity：维护 likesCount/commentsCount 冗余计数（已存在）。
  - Post：不维护冗余计数，按关系/聚合获取（\_count 或 count 聚合）。
- 已有实现：
  - Likes 服务层：lib/interactions/likes.ts（toggle/status/users/count/batch 等）。
  - Likes API：app/api/likes/route.ts（统一认证/响应）。
  - 聚合旧口：app/api/user/interactions/route.ts（like/bookmark 混杂旧的 guards/response）。
  - Server Actions：app/actions/post-actions.ts（like/bookmark 文章侧能力）。

结论：点赞已基本符合统一模式；收藏缺乏统一服务层与路由，需要补齐并收敛历史入口为委托。

## 3. 权限与安全

- 认证策略（withApiAuth from unified-auth）：
  - GET status/users/list：public 或 any（仅读取），视资源与隐私策略区分。
  - POST toggle：user-active（登录且 ACTIVE）。
- 授权与可见性：
  - Likes.users（谁点赞了某目标）：公开读取（社交信号），后续可加开关。
  - Bookmarks.list：默认仅本人和 ADMIN 可读（隐私优先）。
  - 仅本人可变更自己的点赞/收藏状态。
- 限流策略（与评论一致的开关式）：
  - likes：每用户/每IP 每分钟阈值（环境变量）；默认关闭。
  - bookmarks：阈值更低；默认关闭。
  - 参考 `lib/rate-limit/comment-limits.ts` 设计，新增
    `lib/rate-limit/like-limits.ts`, `bookmark-limits.ts`（实现阶段可选）。
- 安全：
  - 输入参数白名单校验；
  - 返回统一错误码（ErrorCode 集）；
  - 不处理用户生成 HTML，无需 XSS 清理；
  - 记录审计日志（动作、资源、用户）。

## 4. API 契约（统一入口 + 兼容入口）

统一响应：`lib/api/unified-response.ts`

- 成功：`{ success: true, data, meta }` 200
- 失败：`{ success: false, error: { code, message, statusCode, details } }`
  status 映射 ErrorCode

### 4.1 Likes API（已存在，补全契约）

- GET /api/likes?action=status&targetType=(post|activity)&targetId=ID
  - 响应：`{ isLiked: boolean, count: number }`
  - 认证：public（含匿名 count）；若带认证则 isLiked 反映当前用户状态；
- GET
  /api/likes?action=users&targetType=(post|activity)&targetId=ID&cursor&limit
  - 响应：`[{ id, name, avatarUrl }]` + pagination.meta
  - 认证：public
- POST /api/likes
  - Body：`{ targetType: 'post'|'activity', targetId: string }`
  - 响应：`{ isLiked: boolean, count: number }`
  - 认证：user-active
- 错误码：VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN,
  RATE_LIMIT_EXCEEDED

### 4.2 Bookmarks API（新增）

- GET /api/bookmarks?action=status&postId=ID
  - 响应：`{ isBookmarked: boolean, count: number }`
  - 认证：public（匿名仅 count；若有用户则附 isBookmarked）
- GET /api/bookmarks?action=list&userId=ID&cursor&limit&include=post
  - 响应：`[{ id, createdAt, post: { id, slug, title, coverImage, author{...} } }]` +
    pagination
  - 认证：仅本人或 ADMIN；否则 FORBIDDEN
  - 备注：仅返回已发布的 Post，避免未发布内容泄漏
- POST /api/bookmarks
  - Body：`{ postId: string }`
  - 响应：`{ isBookmarked: boolean, count: number }`
  - 认证：user-active
- 错误码：同上

### 4.3 兼容入口（保持不变，内部委托）

- `/api/user/interactions`：保留 like/bookmark 分支，内部调用
  `lib/interactions/likes|bookmarks`，返回仍用旧包装，标注 Deprecated。
- `app/actions/post-actions.ts`：以服务层为单一真相源（调用 interactions），对外签名不变。

## 5. 服务层与实现要点

### 5.1 Likes（已有，保持）

- `lib/interactions/likes.ts`
  - toggleLike(targetType, targetId, userId) → { isLiked, count }
  - getLikeStatus(targetType, targetId, userId?) → { isLiked, count }
  - getLikeUsers(targetType, targetId, limit, cursor) → { users, hasMore,
    nextCursor }
  - getLikeCount / getBatchLikeStatus → 供聚合显示
  - 计数：Activity 冗余字段增减；Post 侧聚合

### 5.2 Bookmarks（新增）

- `lib/interactions/bookmarks.ts`
  - toggleBookmark(postId, userId) → { isBookmarked, count }
    - 若存在则删除；否则创建；
    - 计数通过 `prisma.bookmark.count({ where: { postId } })` 获取；
    - 单次数据库往返（无事务），幂等性由唯一约束保障（处理 P2002）；
  - getBookmarkStatus(postId, userId?) → { isBookmarked, count }
  - getUserBookmarks(userId, { cursor, limit }) → { items: BookmarkWithPost[],
    hasMore, nextCursor }
    - 仅返回已发布 Post；按 createdAt desc；
    - include Post 最小必要字段，避免 N+1；
    - limit 边界裁剪（1..100），保证服务层稳健；
    - WHERE userId = ? ORDER BY createdAt DESC 需复合索引 (userId, createdAt
      DESC)；

### 5.3 API 路由实现

- `app/api/bookmarks/route.ts`
  - GET：分发 action=status|list；参数校验→调用服务层→统一响应；
  - POST：withApiAuth('user-active')→校验→调用 toggle→统一响应；
- `app/api/likes/route.ts`
  - 已实现；补充测试覆盖与文档对应性校验；

### 5.4 历史入口委托

- `/api/user/interactions/route.ts`：like/bookmark 分支直接调用服务层，保留旧响应格式与字段，打 Deprecated 注释。
- `app/actions/post-actions.ts`：改调用服务层，避免重复业务逻辑（保持对外签名与消息不变）。

## 6. 前端集成（基于现有组件）

- Activity 卡片：沿用 `/api/likes`，已具备乐观更新；
- 博客详情页：
  - 点赞：沿用 `/api/likes?action=status` + `POST /api/likes`；
  - 收藏：新增 `/api/bookmarks` 同步状态与计数；
  - Post.stats：补充 bookmarksCount（当前 API 缺失，Phase
    8 中补到 posts 列表/详情查询）。
- 个人中心-收藏页：使用
  `/api/bookmarks?action=list&userId=me`（路由层将 me 解析为当前用户）。

## 7. 性能与可观测

- 索引：
  - Like/Bookmark 已有必要唯一与查询索引；
  - Bookmarks：需复合索引 (userId, createdAt DESC) 优化列表查询；
- 计数：Activity 冗余 + Post 聚合，避免写放大；
- 批量状态：列表页使用 `getBatchLikeStatus` 降低 N+1；收藏列表避免多次取 Post；
- 限流：与评论同源实现（开关+阈值），默认关闭；
- 日志：统一使用 logger，记录动作、资源、用户与耗时；错误使用统一错误码。

## 8. 验证与测试

- 单元测试（服务层）：
  - likes：toggle/status/users/count；边界（not found、防重复、匿名）；
  - bookmarks：toggle/status/list；边界（未发布 Post、权限、空列表）。
- 集成测试（API）：
  - /api/likes：GET status/users，POST toggle；
  - /api/bookmarks：GET status/list，POST toggle；
  - 兼容入口：/api/user/interactions like/bookmark 回归；
- 组件测试：
  - 点赞/收藏按钮的可用性（登录/未登录）、乐观更新与异常回滚；
- 覆盖率：Vitest 阈值（lines ≥85%，branches ≥70%）。

## 9. 兼容策略与迁移

- 保留旧入口与 Server Actions，对外行为不变；
- 新增统一路由并优先在新代码中使用；
- 分阶段迁移 posts/activities 相关 API 到 unified-\* 工具（仅新改动），避免一次性重构；
- 文档与代码注释标注 Deprecated；后续版本再评估移除窗口。

## 10. 环境变量（建议）

- LIKES_RATE_LIMIT_ENABLED=false
- LIKES_RATE_LIMIT_WINDOW_MS=60000
- LIKES_RATE_LIMIT_TOGGLE_USER=60
- LIKES_RATE_LIMIT_TOGGLE_IP=120
- BOOKMARKS_RATE_LIMIT_ENABLED=false
- BOOKMARKS_RATE_LIMIT_WINDOW_MS=60000
- BOOKMARKS_RATE_LIMIT_TOGGLE_USER=30
- BOOKMARKS_RATE_LIMIT_TOGGLE_IP=60

## 11. 参考实现（代码路径）

- Likes：
  - Service：`@/lib/interactions/likes.ts`
  - API：`@/app/api/likes/route.ts`
- Bookmarks（新增）：
  - Service：`@/lib/interactions/bookmarks.ts`
  - API：`@/app/api/bookmarks/route.ts`
- 兼容层：
  - Old API：`@/app/api/user/interactions/route.ts`
  - Server Actions：`@/app/actions/post-actions.ts`
- 工具：
  - 认证：`@/lib/api/unified-auth.ts`
  - 响应：`@/lib/api/unified-response.ts`
  - 限流（参考）：`@/lib/rate-limit/comment-limits.ts`

## 12. DoD（完成定义）

- 功能：
  - /api/bookmarks 提供 status/list/toggle，权限与隐私符合策略；
  - /api/likes 契约对齐文档并具备完整测试；
  - posts 列表/详情包含 bookmarksCount；
- 质量：
  - 单元/集成/组件测试通过且覆盖率达标；
  - 性能：核心查询 P95 < 200ms（本地基线）；无明显 N+1；
- 兼容：
  - 旧入口与 Server Actions 行为一致，未破坏现有使用；
  - 文档与弃用注释清晰；

---

### 附：Linus 式决策摘要

【核心判断】✅ 值得做：统一服务层 + 两个资源路由，最少改动，最大一致性，零破坏迁移。

【关键洞察】

- 数据结构清晰：Activity 冗余计数，Post 聚合；收藏无需冗余计数。
- 可消除复杂度：收敛到 unified-\* 工具，合并行为与错误码。
- 风险点：旧聚合路由与 Server Actions；通过“委托而不重写”解决。

【执行步骤】

1. 新增 bookmarks 服务层与 API；
2. posts API 增补 bookmarksCount；
3. 旧入口与 Actions 改为服务层委托；
4. 测试与文档校验；

【Never break userspace】

- 保留旧 API/Actions；新旧并存一段时间，仅做内部委托；逐步迁移。
