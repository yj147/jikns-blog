# 评论 API 性能基线

## 概述

本文档记录评论 API 的性能基线指标，包括测量方法、期望值和复现步骤。

## 测量环境

- **硬件**: 开发机（参考配置：4核 CPU, 8GB RAM）
- **数据库**: Supabase 本地实例
- **测试数据**: 预置测试数据集
- **并发度**: 单线程顺序执行

## 性能指标

### 1. GET /api/comments - 列表查询

#### 测试场景

| 场景               | 数据量 | 期望 P50 | 期望 P95 | 实测 P50 | 实测 P95 |
| ------------------ | ------ | -------- | -------- | -------- | -------- |
| 10条评论（无嵌套） | 10     | <50ms    | <100ms   | -        | -        |
| 10条评论（含回复） | 10+5   | <75ms    | <150ms   | -        | -        |
| 50条评论（无嵌套） | 50     | <100ms   | <200ms   | -        | -        |
| 50条评论（含回复） | 50+25  | <150ms   | <300ms   | -        | -        |

#### 测量命令

```bash
# 基础测试（10条）
curl -w "@curl-format.txt" \
  "http://localhost:3999/api/comments?targetType=post&targetId=test-post-1&limit=10"

# 包含回复（10条）
curl -w "@curl-format.txt" \
  "http://localhost:3999/api/comments?targetType=post&targetId=test-post-1&limit=10&includeReplies=true"

# 大数据量（50条）
curl -w "@curl-format.txt" \
  "http://localhost:3999/api/comments?targetType=post&targetId=test-post-2&limit=50"
```

### 2. POST /api/comments - 创建评论

#### 测试场景

| 场景     | 内容长度 | 期望 P50 | 期望 P95 | 实测 P50 | 实测 P95 |
| -------- | -------- | -------- | -------- | -------- | -------- |
| 短评论   | 50字符   | <30ms    | <60ms    | -        | -        |
| 中等评论 | 200字符  | <40ms    | <80ms    | -        | -        |
| 长评论   | 800字符  | <50ms    | <100ms   | -        | -        |
| 带回复   | 100字符  | <40ms    | <80ms    | -        | -        |

#### 测量命令

```bash
# 短评论
curl -X POST -w "@curl-format.txt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"targetType":"post","targetId":"test-post-1","content":"This is a short comment"}' \
  "http://localhost:3999/api/comments"

# 长评论
curl -X POST -w "@curl-format.txt" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"targetType":"post","targetId":"test-post-1","content":"'$(python -c "print('x'*800)")'"}"' \
  "http://localhost:3999/api/comments"
```

### 3. DELETE /api/comments/[id] - 删除评论

#### 测试场景

| 场景       | 条件               | 期望 P50 | 期望 P95 | 实测 P50 | 实测 P95 |
| ---------- | ------------------ | -------- | -------- | -------- | -------- |
| 软删除     | 用户删除自己的评论 | <25ms    | <50ms    | -        | -        |
| 管理员删除 | 管理员删除任意评论 | <25ms    | <50ms    | -        | -        |

#### 测量命令

```bash
# 删除评论
curl -X DELETE -w "@curl-format.txt" \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3999/api/comments/comment-id-123"
```

## curl 格式文件

创建 `curl-format.txt` 文件：

```txt
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer:  %{time_pretransfer}s\n
time_redirect:  %{time_redirect}s\n
time_starttransfer:  %{time_starttransfer}s\n
----------\n
time_total:  %{time_total}s\n
```

## 性能测量脚本

使用 `scripts/measure-comments.ts` 进行自动化测量（见下文）。

## 运行测试

### 1. 准备环境

```bash
# 启动本地 Supabase
pnpm supabase:start

# 启动开发服务器
pnpm dev

# 准备测试数据
pnpm db:seed
```

### 2. 执行测量

```bash
# 运行性能测量脚本
pnpm tsx scripts/measure-comments.ts

# 或手动执行 curl 命令
./test-performance.sh
```

### 3. 查看指标

访问 `http://localhost:3999/api/comments/metrics`
查看实时指标（如果已实现指标端点）。

## 性能优化建议

### 当前实现

1. **游标分页**: 已实现，避免深分页性能问题
2. **索引优化**: 确保 targetType + targetId 有复合索引
3. **N+1 查询**: 使用 include 避免 N+1 问题

### 未来优化

1. **缓存层**:
   - 热门评论缓存（Redis）
   - 用户信息缓存
2. **数据库优化**:
   - 分区表（按时间或 targetId）
   - 读写分离
3. **API 优化**:
   - 批量操作接口
   - GraphQL 减少过度获取

## 监控告警阈值

| 指标     | 警告阈值 | 严重阈值 |
| -------- | -------- | -------- |
| P50 延迟 | >100ms   | >200ms   |
| P95 延迟 | >300ms   | >500ms   |
| P99 延迟 | >500ms   | >1000ms  |
| 错误率   | >1%      | >5%      |
| QPS      | -        | >1000    |

## 性能测试检查清单

- [ ] 本地环境已启动
- [ ] 测试数据已准备
- [ ] 基线测试已运行
- [ ] 结果已记录
- [ ] 异常已分析
- [ ] 优化建议已记录

## 历史记录

| 日期       | 版本   | P50 (list) | P95 (list) | P50 (create) | P95 (create) | 备注     |
| ---------- | ------ | ---------- | ---------- | ------------ | ------------ | -------- |
| 2024-01-01 | v1.0.0 | -          | -          | -            | -            | 初始基线 |

## 相关文档

- [评论系统架构设计](./评论系统架构.md)
- [数据库索引优化](./数据库优化.md)
- [缓存策略](./缓存策略.md)
