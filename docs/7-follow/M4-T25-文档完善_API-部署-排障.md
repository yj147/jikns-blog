# M4 T25 文档完善（API 文档 / 部署指南 / 故障排查）

版本: v1.0 日期: 2025-10-09 范围: 关注系统（Follow）

---

## 一、API 文档（关注系统）

### 1) 批量状态查询（T9）

- 方法/路径：POST /api/users/follow/status
- 鉴权：assertPolicy("user-active")（登录且 ACTIVE）
- 请求体：

```json
{ "targetIds": ["user-1", "user-2", "..."] }
```

- 限制：1 ≤ targetIds.length ≤ 50；超限返回 VALIDATION_ERROR
- 速率限制：follow-status 20/min
- 响应（成功）：

```json
{
  "success": true,
  "data": {
    "user-1": {
      "isFollowing": true,
      "isMutual": false
    },
    "user-2": {
      "isFollowing": false,
      "isMutual": false
    }
  },
  "meta": {
    "timestamp": "2025-11-03T14:00:00.000Z",
    "requestId": "req-abc123"
  }
}
```

- 字段说明：
  - `isFollowing`: 当前用户是否关注目标用户
  - `isMutual`: 是否互相关注（双向关注关系）
- 错误：统一 createErrorResponse（含 error.code/message）

### 2) 粉丝列表（T7）

- GET /api/users/[userId]/followers?limit=20&cursor=...
- 鉴权：assertPolicy("public")
- 响应：createPaginatedResponse(data, pagination, { requestId })

### 3) 关注列表（T8）

- GET /api/users/[userId]/following?limit=20&cursor=...
- 鉴权：assertPolicy("public")
- 响应：同上（含 isMutual 字段）

---

## 二、部署指南（最小可用，开发/演练）

1. 环境准备

- Node 22.x、pnpm 9.x
- 本地 Supabase CLI（dev 环境）
- 复制 .env.example → .env.local，填充 Supabase/GitHub OAuth

2. 初始化

- pnpm install
- pnpm supabase:start
- pnpm db:push && pnpm db:seed
- pnpm dev（默认 http://localhost:3999）

3. 验证

- pnpm test:critical
- 关注系统相关：
  - pnpm vitest run tests/api/follow-\*.test.ts
  - pnpm vitest run tests/hooks --run

4. 监控演练

- bash scripts/collect-monitoring-data.sh --focus follow（如已配置）

---

## 三、故障排查（FAQ）

- Q: follow/status 返回 422 / 400？
  - A: 检查 targetIds 是否为非空数组、长度 ≤ 50。
- Q: 返回 429（限流）？
  - A: 降低频率；观察 FOLLOW_ACTION_RATE_LIMIT 指标；必要时调整配额。
- Q: "+互相关注" 徽标不显示？
  - A: 该信息来自列表 API 的 isMutual 字段，非 T9。
- Q: 跟随按钮状态不同步？
  - A: useFollowUser 成功回调会触发默认刷新键，确保 `/api/users/follow/status`
    缓存被刷。
- Q: 质量检查失败？
  - A: 仓库历史测试（security/integration）存在解析错误，非关注系统引入；可在 CI 层暂时排除相应路径，或另立任务修复。

---

## 四、审计与指标确认清单

- 审计：requestId、userId、action、resource、success、severity、details、ip、ua 均记录
- 指标：FOLLOW_ACTION_DURATION / FOLLOW_ACTION_RATE_LIMIT /
  FEED_FOLLOWING_RESULT_COUNT 正常写入

---

## 五、联系人

- Backend：Owner-A
- Frontend：Owner-B
- Platform：Owner-C
- Security：Owner-D
