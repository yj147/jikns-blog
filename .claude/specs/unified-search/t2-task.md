# T2: 搜索服务层与 API 实现任务

## 背景
T1 已完成：User 和 Tag 表已添加 search_vector FTS 字段和 GIN 索引。

## 任务清单

### 1. types/search.ts
创建搜索相关的 TypeScript 类型定义

### 2. lib/services/search.ts
创建统一搜索服务：
- unifiedSearch 函数并行查询 Post/Activity/User/Tag
- 使用 PostgreSQL FTS 的 search_vector 字段
- 时间加权排序算法

### 3. app/api/search/route.ts
创建 GET API 端点：
- Zod schema 验证参数
- 速率限制
- 统一响应格式

### 4. tests/integration/unified-search.test.ts
测试覆盖率 90% 以上

## 参考文件
- app/api/activities/route.ts
- prisma/schema.prisma
- lib/api/unified-response.ts
