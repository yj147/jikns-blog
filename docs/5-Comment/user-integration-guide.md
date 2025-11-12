# 评论系统 - 用户与集成指南

## 概述

本项目的评论系统支持对文章（Post）和动态（Activity）两种内容类型的评论功能，提供完整的创建、查看、回复、删除等操作。

## 核心功能

### 1. 评论管理

- **创建评论**：登录用户可对文章和动态发表评论
- **查看评论**：所有用户（含未登录）可查看评论列表
- **回复评论**：支持单层回复（@某人）
- **删除评论**：
  - 软删除：有子回复时仅标记删除，内容显示为"该评论已删除"
  - 硬删除：无子回复时物理删除记录并更新计数

### 2. 权限控制

- **查看**：公开访问，无需登录
- **创建/回复**：需要登录且账户状态为 ACTIVE
- **删除**：仅作者本人或管理员可删除

### 3. 限流保护

评论系统内置限流机制，防止滥用：

- 创建评论：默认每用户每分钟 20 条、每 IP 每分钟 60 条
- 删除评论：默认每用户每分钟 10 次、每 IP 每分钟 30 次
- IP 级别限流：防止恶意攻击，所有请求同时受用户维度/ IP 维度约束
- 生产环境须配置 Upstash
  Redis（或兼容 REST 接口的 Redis 服务），实现跨实例限流；若未配置则自动回退为单实例内存限流，仅推荐用于本地开发

## API 接口

### 通用评论接口

```typescript
// 获取评论列表
GET /api/comments?targetType=post&targetId=xxx&cursor=xxx&limit=20

// 创建评论
POST /api/comments
{
  "targetType": "post|activity",
  "targetId": "xxx",
  "content": "评论内容",
  "parentId": "xxx" // 可选，回复时传入
}

// 删除评论
DELETE /api/comments/{id}
```

### 兼容层接口

为保持向后兼容，动态评论支持两种访问方式：

```typescript
// 新版通用接口
GET /api/comments?targetType=activity&targetId={id}

// 兼容旧版接口
GET /api/activities/{id}/comments
```

## 前端集成

### 使用通用评论组件

```tsx
import CommentList from "@/components/comments/comment-list"

// 在文章页面
<CommentList targetType="post" targetId={postId} />

// 在动态页面
<CommentList targetType="activity" targetId={activityId} />
```

### 评论状态管理

> `CommentList` 已内建游标分页、`parentId`
> 回复拉取与成功回调刷新，如需自定义可以参考组件源码按需封装 `useSWRInfinite`。

## 环境配置

### 必需的环境变量

```env
# 数据库连接
DATABASE_URL=your_database_url

# 限流配置（可选，有默认值）
COMMENTS_RATE_LIMIT_ENABLED=true
COMMENTS_RATE_LIMIT_WINDOW_MS=60000
COMMENTS_RATE_LIMIT_CREATE_USER=20
COMMENTS_RATE_LIMIT_CREATE_IP=60
COMMENTS_RATE_LIMIT_DELETE_USER=10
COMMENTS_RATE_LIMIT_DELETE_IP=30

# 集中式限流存储（推荐 Upstash Redis）
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"
```

### 开发环境设置

```bash
# 安装依赖
pnpm install

# 启动本地数据库
pnpm supabase:start

# 运行迁移
pnpm db:push

# 启动开发服务器
pnpm dev
```

## 测试

### 运行测试

```bash
# 评论模块核心用例
pnpm vitest run tests/integration/comments-service.test.ts
pnpm vitest run tests/integration/comments-rate-limit.test.ts
pnpm vitest run tests/components/comments/comment-list.test.tsx
pnpm vitest run tests/unit/list-activities-pagination.test.ts

# E2E 验证
pnpm test:e2e tests/e2e/comments-flow.spec.ts
```

### 测试覆盖范围

- ✅ API 路由测试
- ✅ 限流机制测试
- ✅ 权限控制测试
- ✅ 软删除/硬删除逻辑
- ✅ 兼容层一致性
- ✅ E2E 完整流程

## 监控与日志

### 日志记录

评论系统使用结构化日志记录所有操作：

```typescript
// 日志格式
{
  "module": "comments",
  "operation": "create|list|delete",
  "actor": "userId|anonymous",
  "target": "post:id|activity:id",
  "status": "success|failure",
  "duration": 123.45,
  "requestId": "uuid"
}
```

### 性能指标

系统自动收集以下指标：

- 操作耗时
- 成功/失败率
- 限流触发次数
- 并发请求数

## 最佳实践

### 1. 错误处理

```typescript
try {
  const comment = await createComment(data)
  toast.success("评论发表成功")
} catch (error) {
  if (error.code === "RATE_LIMIT_EXCEEDED") {
    toast.error(`请等待 ${error.retryAfter} 秒后重试`)
  } else {
    toast.error("评论发表失败，请重试")
  }
}
```

### 2. 分页加载

```typescript
const loadMore = async () => {
  const { data } = await fetch(`/api/comments?cursor=${nextCursor}&limit=20`)
  setComments([...comments, ...data.items])
  setNextCursor(data.nextCursor)
}
```

### 3. 乐观更新

```typescript
// 先更新 UI，后台同步
const optimisticDelete = async (commentId: string) => {
  // 立即更新 UI
  setComments(comments.filter((c) => c.id !== commentId))

  // 后台删除
  try {
    await deleteComment(commentId)
  } catch (error) {
    // 失败时回滚
    setComments(comments)
    toast.error("删除失败")
  }
}
```

## 故障排查

### 常见问题

1. **评论发表失败**
   - 检查用户登录状态
   - 验证账户状态是否为 ACTIVE
   - 查看是否触发限流

2. **评论不显示**
   - 检查 targetType 和 targetId 参数
   - 验证数据库连接
   - 查看控制台错误日志

3. **删除失败**
   - 确认用户权限
   - 检查是否有子回复（软删除场景）
   - 查看审计日志

### 调试工具

```bash
# 查看评论系统日志
tail -f logs/comments.log

# 检查限流状态
curl http://localhost:3000/api/dev/rate-limit-status

# 重置限流（开发环境）
curl -X POST http://localhost:3000/api/dev/reset-rate-limit
```

## 版本历史

### v1.0.0 (2024-01)

- 初版评论系统
- 支持文章和动态评论
- 基础 CRUD 功能

### v1.1.0 (2024-02)

- 添加软删除/硬删除逻辑
- 实现限流保护
- 优化性能监控

### v1.2.0 (2024-03)

- 统一 API 接口
- 添加兼容层
- 改进错误处理

## 相关文档

- [API 文档](/docs/api/comments.md)
- [数据库设计](/docs/database/comments-schema.md)
- [架构设计](/docs/architecture/comments-system.md)
- [性能优化指南](/docs/performance/comments-optimization.md)
