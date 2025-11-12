# Phase 9 关注系统 - Release Note

**版本**: v1.0.0 **发布日期**: 2025-10-09 **模块**: 用户关注系统
**目标读者**: 开发团队、运维团队

---

## 1. 功能清单

### 1.1 核心功能

- ✅ **用户关注/取关**
  - 幂等操作：重复关注/取关不会产生错误
  - 防止自关注：系统自动拒绝用户关注自己的请求
  - 乐观更新：前端即时反馈，失败时自动回滚

- ✅ **粉丝/关注列表查询**
  - 分页支持：基于游标的高效分页（limit + nextCursor）
  - 性能优化：索引优化，单次查询<100ms
  - 数据完整：包含用户基本信息、关注时间、互关状态

- ✅ **批量状态查询**
  - 批量查询：一次请求最多查询50个用户的关注状态
  - 减少N+1问题：避免前端列表页面的重复请求
  - 速率限制：20次/分钟

- ✅ **Feed关注流**
  - 关注Tab：仅展示被关注用户的动态内容
  - 实时过滤：基于关注关系动态过滤
  - 空态处理：未关注任何人时显示引导性提示

---

## 2. API 变更

### 2.1 新增API端点

#### POST /api/users/[userId]/follow

**描述**：关注指定用户

**请求**：

```http
POST /api/users/user-123/follow
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
```

**响应**：

```json
{
  "success": true,
  "data": {
    "followerId": "user-1",
    "followingId": "user-123",
    "createdAt": "2025-10-09T03:00:00.000Z",
    "wasNew": true,
    "targetName": "Linus Torvalds"
  },
  "meta": {
    "timestamp": "2025-10-09T03:00:00.123Z",
    "requestId": "req-abc123"
  }
}
```

**错误代码**：

- `400 VALIDATION_ERROR`: 不能关注自己
- `404 NOT_FOUND`: 目标用户不存在
- `429 RATE_LIMIT_EXCEEDED`: 超过速率限制（30次/分钟）

---

#### DELETE /api/users/[userId]/follow

**描述**：取消关注指定用户

**请求**：

```http
DELETE /api/users/user-123/follow
Authorization: Bearer <token>
X-CSRF-Token: <csrf_token>
```

**响应**：

```json
{
  "success": true,
  "data": {
    "followerId": "user-1",
    "followingId": "user-123",
    "wasDeleted": true
  },
  "meta": {
    "timestamp": "2025-10-09T03:00:01.456Z",
    "requestId": "req-abc124"
  }
}
```

**特性**：

- 幂等操作：未关注时取关返回 `wasDeleted: false` 但仍然成功

---

#### GET /api/users/[userId]/followers

**描述**：获取用户的粉丝列表

**请求参数**：

- `limit` (number, optional): 每页数量，默认20，最大50
- `cursor` (string, optional): 分页游标

**请求**：

```http
GET /api/users/user-123/followers?limit=20&cursor=fol_abc...
```

**响应**：

```json
{
  "success": true,
  "data": [
    {
      "id": "user-456",
      "name": "Linus",
      "avatarUrl": "https://...",
      "bio": "...",
      "isMutual": true,
      "followedAt": "2025-10-08T12:30:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 145,
      "hasMore": true,
      "nextCursor": "fol_xyz..."
    },
    "timestamp": "2025-10-09T03:00:02.789Z",
    "requestId": "req-abc125"
  }
}
```

---

#### GET /api/users/[userId]/following

**描述**：获取用户的关注列表

**请求参数**：同 `/followers`

**响应格式**：同 `/followers`

---

#### POST /api/users/follow/status

**描述**：批量查询关注状态

**请求**：

```json
{
  "targetIds": ["user-1", "user-2", "user-3"]
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "user-1": { "isFollowing": true },
    "user-2": { "isFollowing": false },
    "user-3": { "isFollowing": true }
  },
  "meta": {
    "timestamp": "2025-10-09T03:00:03.012Z",
    "requestId": "req-abc126"
  }
}
```

**限制**：

- 最多查询50个用户ID
- 速率限制：20次/分钟

---

## 3. 配置说明

### 3.1 环境变量

#### FEATURE_FEED_FOLLOWING_STRICT

**类型**：布尔值（`true` | `false` | `1` | `0`） **默认值**：`true`（功能开启）
**用途**：控制关注系统功能的启用/禁用

**设置示例**：

```bash
# 开启关注功能（默认）
export FEATURE_FEED_FOLLOWING_STRICT=true

# 关闭关注功能（回滚）
export FEATURE_FEED_FOLLOWING_STRICT=false
```

**降级行为**（`false`时）：

- Feed页面："关注"Tab完全隐藏
- FollowButton组件：显示但禁用，hover显示"该功能暂时维护中"
- Settings页面：可查看现有列表，但无法执行关注/取关操作

---

### 3.2 速率限制

| 操作              | 限制     | 时间窗口 | 错误代码            |
| ----------------- | -------- | -------- | ------------------- |
| 关注/取关         | 30次     | 60秒     | RATE_LIMIT_EXCEEDED |
| 批量状态查询      | 20次     | 60秒     | RATE_LIMIT_EXCEEDED |
| 粉丝/关注列表查询 | 共享限制 | 60秒     | RATE_LIMIT_EXCEEDED |

**实现方式**：

- 开发环境：内存限流（单实例）
- 生产环境：Redis限流（集中式，需配置`UPSTASH_REDIS_*`环境变量）

---

### 3.3 性能监控指标

系统已集成3个关注系统性能指标（`lib/performance-monitor.ts`）：

| 指标名称                      | 类型 | 单位  | 描述                     |
| ----------------------------- | ---- | ----- | ------------------------ |
| `FOLLOW_ACTION_DURATION`      | 计时 | ms    | 关注/取关操作响应时间    |
| `FOLLOW_ACTION_RATE_LIMIT`    | 计数 | count | 速率限制触发次数         |
| `FEED_FOLLOWING_RESULT_COUNT` | 计数 | count | 关注流查询返回的动态数量 |

**日志示例**：

```json
{
  "type": "FOLLOW_ACTION_DURATION",
  "value": 45,
  "unit": "ms",
  "timestamp": "2025-10-09T03:00:00.123Z",
  "context": {
    "userId": "user-1",
    "requestId": "req-abc123"
  }
}
```

---

## 4. 灰度上线步骤

### 4.1 阶段A：内部测试（1-2天）

**目标**：验证功能正确性和性能指标

**步骤**：

1. 在Staging环境部署
2. 使用内部测试账号执行完整测试流程
3. 验证性能指标正确记录（查看应用日志）
4. 验证Feature Flag开关行为正确

**验收标准**：

- ✅ 所有API测试通过
- ✅ E2E测试连续3次通过
- ✅ 性能指标在日志中可观察到
- ✅ Feature Flag开关行为正确

---

### 4.2 阶段B：小规模灰度（2-3天）

**目标**：验证生产环境稳定性

**步骤**：

1. 部署到生产环境（`FEATURE_FEED_FOLLOWING_STRICT=true`）
2. 限制10%用户访问（通过Vercel Edge Config或类似机制）
3. 监控关键指标：
   - API响应时间（P95<200ms）
   - 错误率（<1%）
   - 速率限制命中率（<5%）
4. 收集用户反馈

**回滚条件**：

- 错误率>5%
- P95响应时间>500ms
- 出现严重用户体验问题

---

### 4.3 阶段C：全量上线（1天）

**步骤**：

1. 逐步扩大灰度比例：10% → 50% → 100%
2. 持续监控指标和用户反馈
3. 确认无异常后宣布正式上线

---

## 5. 回滚步骤

### 5.1 快速回滚（Feature Flag）

**场景**：功能出现问题，需要立即关闭

**步骤**：

```bash
# 1. 设置环境变量
export FEATURE_FEED_FOLLOWING_STRICT=false

# 2. 重启应用（具体命令取决于部署方式）
# Vercel: 通过环境变量更新自动触发重新部署
# Docker: docker-compose restart
# PM2: pm2 restart all

# 3. 验证UI降级行为
# - Feed页面：关注Tab消失
# - 关注按钮：显示"该功能暂时维护中"
```

**预期结果**：

- 用户无法执行新的关注/取关操作
- 现有关注关系数据保持不变
- 用户仍可查看现有的粉丝/关注列表（只读）

---

### 5.2 完全回滚（代码级别）

**场景**：需要完全移除关注功能代码

**步骤**：

```bash
# 1. 回滚到上一个稳定版本
git revert <commit_hash>

# 2. 重新部署
git push origin main

# 3. 验证功能恢复
```

**注意事项**：

- 数据库中的Follow表数据保持不变（向后兼容）
- 不需要运行数据库迁移回滚

---

## 6. 已知限制

### 6.1 功能限制

- **批量查询限制**：一次最多查询50个用户ID
- **隐私设置**：当前关注关系全部公开，暂不支持隐私设置（如"私密账号"、"仅粉丝可见"）
- **推荐算法**：暂不支持基于关注关系的推荐算法（如"共同关注"、"你可能认识"）

### 6.2 性能限制

- **关注数量**：单个用户关注数量建议<5000（超过后列表查询性能可能下降）
- **粉丝数量**：单个用户粉丝数量建议<10000（超过后需要优化索引）

### 6.3 后续计划（Phase 10+）

- 推荐算法优化（共同关注、基于兴趣的推荐）
- 隐私设置（私密账号、关注审批）
- 推送通知（新粉丝通知、关注用户更新）
- 黑名单功能（拉黑用户）

---

## 7. 兼容性说明

### 7.1 向后兼容性

✅ **无破坏性变更**

- 现有API保持不变
- 数据库schema无需迁移
- 前端API调用保持统一响应格式

✅ **数据兼容性**

- 现有Follow表数据保持不变
- 新增字段均有默认值
- 支持渐进式升级

✅ **前端兼容性**

- 未登录用户：关注功能禁用，不影响浏览
- 旧版客户端：忽略关注相关UI，不会崩溃

---

### 7.2 依赖版本

| 依赖       | 版本    | 说明                |
| ---------- | ------- | ------------------- |
| Next.js    | 15.5.0  | App Router模式      |
| TypeScript | 5.9.2   | 严格模式            |
| Prisma     | 6.14.0  | ORM层               |
| Supabase   | 本地CLI | 数据库              |
| Playwright | 1.49.1  | E2E测试（开发依赖） |

---

## 8. 技术债务

### 8.1 当前技术债务

无

### 8.2 未来优化点

- **性能优化**：针对大V用户（粉丝数>10万）的列表查询优化
- **缓存策略**：引入Redis缓存热门用户的关注列表
- **监控增强**：添加`--focus follow`参数支持到监控脚本（P2优先级）

---

## 9. 联系方式

**问题反馈**：

- GitHub Issues: [项目仓库]/issues
- 技术支持：dev-team@example.com

**文档更新**：

- 设计文档：`docs/7-follow/Phase9-关注系统设计.md`
- 任务计划：`docs/7-follow/Phase9-关注系统任务计划.md`

---

**发布批准**：

- [ ] 开发团队审核通过
- [ ] QA团队验证通过
- [ ] 产品负责人批准
- [ ] 运维团队确认部署方案

**发布日期**：待定（完成所有验收后）
