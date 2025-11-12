# Phase 8：Like & Collection 模块技术债审计报告（2025-09-28）

## 1. 背景与范围

- **审计目标**：评估点赞（Like）与收藏（Bookmark）模块在 Phase
  8 任务完成后的技术债务现状，确认服务层、API、限流与文档是否满足统一契约与“Never
  break userspace”的要求。
- **代码基线**：`main` 分支（2025-09-28）。重点文件包含
  `lib/interactions/likes.ts`、`lib/interactions/bookmarks.ts`、`app/api/likes/route.ts`、`app/api/bookmarks/route.ts`、`lib/rate-limit/like-limits.ts`、`lib/rate-limit/bookmark-limits.ts`
  以及相关测试与文档。
- **方法**：
  1. 逐项对照 Phase 8 工作流计划与技术设计文档。
  2. 静态审查服务层与 API 关键路径。
  3. 实地运行核心测试集合，记录失败用例。
  4. 评估文档与命令指引的可执行性。

## 2. 核心结论速览

| 序号 | 整改项                                        | 当前状态  | 验证证据                                                                                                                                                                                                        |
| ---- | --------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ①    | 收藏服务层分页排序与同秒游标稳定性            | ✅ 已关闭 | `lib/interactions/bookmarks.ts:164-229`、`tests/unit/bookmarks-service.test.ts:639-699`、`pnpm vitest run tests/unit/bookmarks-service.test.ts`                                                                 |
| ②    | 点赞/收藏限流接入 Redis + 内存回退 + 指标上报 | ✅ 已关闭 | `lib/rate-limit/shared.ts:17-76`、`lib/rate-limit/like-limits.ts:35-111`、`lib/rate-limit/bookmark-limits.ts:35-111`、`pnpm vitest run tests/unit/toggle-rate-limits.test.ts tests/unit/comment-limits.test.ts` |
| ③    | 点赞用户列表 DTO 瘦身为最小披露               | ✅ 已关闭 | `lib/interactions/likes.ts:156-210`、`tests/unit/likes-service.test.ts:315-358`、`tests/api/likes-route.test.ts:140-198`                                                                                        |
| ④    | 文档命令与验证指引更新                        | ✅ 已关闭 | `docs/6-Like and collection/Phase8-工作流任务计划.md:180-205`、`docs/6-Like and collection/P8-BE-1-收藏服务层完成报告.md:160-204`                                                                               |

## 3. 详细发现

## 3. 整改闭环说明

### 3.1 收藏服务层分页稳定性

- **处理**：服务实现保持 `createdAt desc + id desc`
  稳定排序，并在单测中新增“同一时间戳保持游标稳定”用例，防止游标跳项。
- **验证**：`pnpm vitest run tests/unit/bookmarks-service.test.ts`。

### 3.2 点赞/收藏限流能力

- **处理**：新增 `applyDistributedRateLimit`，优先 Redis 失败回退内存；补全
  `MetricType.LIKE_RATE_LIMIT_CHECK/BOOKMARK_RATE_LIMIT_CHECK`
  指标；文档与环境变量指引同步更新。
- **验证**：`pnpm vitest run tests/unit/toggle-rate-limits.test.ts tests/unit/comment-limits.test.ts`。

### 3.3 点赞用户列表 DTO

- **处理**：`getLikeUsers` 返回瘦身后的
  `{id,name,avatarUrl}`，API/组件测试同步断言无额外字段泄露。
- **验证**：`pnpm vitest run tests/unit/likes-service.test.ts tests/api/likes-route.test.ts`。

### 3.4 文档命令与验证清单

- **处理**：Phase
  8 文档更新为现行命令（`pnpm vitest run …`、`pnpm test:e2e …`），并补充“限流 & 分页”验证 checklist。
- **验证**：文档审阅与命令实测，见 4. 节。

## 4. 验证情况

| 命令                                                                                      | 结果    | 说明                                         |
| ----------------------------------------------------------------------------------------- | ------- | -------------------------------------------- |
| `pnpm vitest run tests/unit/bookmarks-service.test.ts`                                    | ✅ 通过 | 游标稳定性、字段覆盖用例全部绿灯。           |
| `pnpm vitest run tests/unit/toggle-rate-limits.test.ts tests/unit/comment-limits.test.ts` | ✅ 通过 | Redis 成功/429、内存回退、封顶分支均被命中。 |
| `pnpm vitest run tests/unit/likes-service.test.ts tests/api/likes-route.test.ts`          | ✅ 通过 | DTO 输出与 API 契约保持一致。                |
| `pnpm vitest run tests/api/bookmarks-route.test.ts`                                       | ✅ 通过 | 权限/分页/限流分支全部覆盖。                 |

## 5. 建议的下一步（Linus 式）

当前 Like & Collection 模块不存在未结技术债务。持续维护建议：

1. 回归测试：发布前执行上表四组命令，保持游标、限流、DTO 契约不回退。
2. Redis 运行监控：关注 `MetricType.LIKE_RATE_LIMIT_CHECK` /
   `BOOKMARK_RATE_LIMIT_CHECK`
   日志，确保 backend=redis 与 backend=memory 比例符合预期。
3. 文档同步：如增补新变更，请同步更新 Phase
   8 文档中的验证清单与命令示例，维持 QA 可操作性。
