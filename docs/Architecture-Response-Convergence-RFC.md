# 响应工具收敛方案

## 现状分析

### 响应工具分布

1. **lib/api-response.ts**
   - 函数：`createSuccessResponse`, `createErrorResponse`
   - 错误码：`ActivityErrorCode` 枚举
   - 使用范围：主要用于活动、评论、点赞、收藏等功能模块

2. **lib/api/unified-response.ts**
   - 函数：`createApiResponse` (推测，需确认)
   - 错误码：`ErrorCode` 枚举（更通用）
   - 定位：作为统一响应工具存在，但未完全推广使用

### 使用情况（15个文件）

- posts, comments, likes, bookmarks, activities 等核心 API
- 大部分使用 `createSuccessResponse/createErrorResponse`
- 响应格式基本一致，但错误码体系有差异

## 收敛方案

### 目标架构

统一到 **lib/api/unified-response.ts**，废弃 lib/api-response.ts

### 实施步骤

#### 第一阶段：工具整合

1. **合并错误码枚举**
   - 将 `ActivityErrorCode` 迁移到 `ErrorCode`
   - 保持向后兼容的错误码值
   - 添加统一的错误码前缀规范

2. **函数签名统一**

   ```typescript
   // 统一的成功响应
   createApiSuccess<T>(data: T, options?: {
     status?: number
     pagination?: PaginationMeta
     meta?: Record<string, any>
   })

   // 统一的错误响应
   createApiError(code: ErrorCode, message: string, options?: {
     status?: number
     details?: any
   })
   ```

#### 第二阶段：渐进式替换（影响面控制）

**替换顺序**（从低风险到高风险）：

1. **第一批**（独立性强，影响小）：
   - `/api/posts` - 博客文章API
   - `/api/admin/posts` - 管理员文章API
   - `/api/security-demo` - 演示API

2. **第二批**（用户相关）：
   - `/api/user/interactions` - 用户交互
   - `/api/likes` - 点赞功能
   - `/api/bookmarks` - 收藏功能

3. **第三批**（复杂交互）：
   - `/api/comments/*` - 评论系统
   - `/api/activities/*` - 动态系统
   - `/api/upload/images` - 图片上传

#### 第三阶段：清理

- 标记 lib/api-response.ts 为废弃
- 更新所有测试文件
- 删除旧文件

### 兼容性保证

**JSON 响应格式保持不变**：

```json
{
  "success": true/false,
  "data": {...},
  "error": {
    "code": "ERROR_CODE",
    "message": "错误消息",
    "details": {...}
  },
  "meta": {
    "timestamp": "ISO8601",
    "pagination": {...}
  }
}
```

### 风险评估

- **低风险**：响应格式不变，仅内部实现改变
- **中风险**：错误码迁移可能影响前端错误处理
- **缓解措施**：保留原错误码值，仅改变内部组织

### 执行计划

1. **今日**：完成 posts API 试点（RESP-Refactor-2）
2. **明日**：完成第一批剩余 API
3. **后天**：完成第二、三批，全面测试

## 决策记录

- **为什么选择 unified-response.ts**：命名更通用，位置更合理（lib/api/目录）
- **为什么不内联到 api-response.ts**：避免git历史混乱，清晰的迁移路径
- **为什么渐进式替换**：降低风险，便于回滚，保证线上稳定性
