# 归档 API 参考

更新时间：2025-10-10

本文档描述归档模块对外暴露的 HTTP 接口。所有接口默认在 `https://<域名>`
下，示例以本地开发地址 `http://localhost:3999` 展示。

## GET /api/archive/chunk

按年份分页拉取时间线数据，供前端懒加载使用。

### 请求参数

| 参数名   | 类型   | 说明                          | 默认值 |
| -------- | ------ | ----------------------------- | ------ |
| `offset` | number | 已加载的年份数量              | `0`    |
| `limit`  | number | 本次加载的年份数量，最大值 12 | `3`    |

### 响应示例

```json
{
  "years": [
    {
      "year": 2022,
      "totalCount": 18,
      "months": [
        {
          "month": 12,
          "monthName": "十二月",
          "count": 3,
          "posts": [
            {
              "id": "post_20221201",
              "title": "年终复盘",
              "slug": "year-in-review",
              "summary": "2022 年重点事件归档",
              "publishedAt": "2022-12-01T08:00:00.000Z",
              "tags": []
            }
          ]
        }
      ]
    }
  ],
  "hasMore": true,
  "nextOffset": 6,
  "totalYears": 9
}
```

### 状态码

- `200` 请求成功
- `400` `offset`/`limit` 参数非法
- `500` 内部错误（详见服务器日志）

## GET /api/archive/search

在归档范围内全文检索文章。

### 请求参数

| 参数名 | 类型   | 说明                       | 必填 |
| ------ | ------ | -------------------------- | ---- |
| `q`    | string | 搜索关键字（2~100 个字符） | ✅   |
| `year` | number | 限定年份                   | ❌   |

### 响应示例

```json
{
  "results": [
    {
      "id": "post-1",
      "title": "Playwright 归档测试",
      "slug": "playwright-archive-test",
      "summary": "关于 Playwright 的端到端测试记录",
      "publishedAt": "2025-02-10T00:00:00.000Z",
      "tags": [
        {
          "tag": {
            "id": "tag-1",
            "name": "Testing",
            "slug": "testing"
          }
        }
      ]
    }
  ]
}
```

### 状态码与错误语义

- `200`
  - 正常返回 `results`
  - 当 `q` 少于 2 个字符时返回 `{ message: "QUERY_TOO_SHORT", results: [] }`
- `400`
  - 当 `q` 超过 100 个字符时返回 `{ message: "QUERY_TOO_LONG", results: [] }`
  - 年份参数无法解析时返回 `{ message: "INVALID_YEAR" }`
- `500` 内部错误（`message: "SEARCH_FAILED"`）

### 结果集限制

- 使用 PostgreSQL `websearch_to_tsquery('simple')` 与 `ts_rank`
- 最多返回 20 条结果（按相关度 + 发布时间排序）

## 缓存策略

- `/api/archive/chunk` 使用 `unstable_cache` 缓存 3600 秒。基础列表查询始终绑定
  `archive:list` 与 `archive:years`，按年 / 月查询则额外附加
  `archive:year:<year>` 或 `archive:month:<year>-<month>`
  标签，确保任意年份的变更都能精准失效而不污染其他窗口。
- 文章 CRUD 通过 `revalidateArchiveCache` 同步触发
  `archive:list`、`archive:years`、`archive:stats`
  以及所有受影响年份 / 月份的标签，避免遗漏。
- `/api/archive/search` 设置
  `revalidate = 0`，所有查询实时命中数据库，不做缓存，以保证搜索结果立即反映最新内容。

前端仍对 `/api/archive/chunk` 采用 `cache: 'no-store'`
避免浏览器缓存干扰懒加载，而搜索接口默认实时请求无需额外缓存层。

## 错误排查

1. 检查 API 返回是否包含 `message`
2. 查看 `logs/audit-*.log` 与 Next.js 服务器日志
3. 若是 Prisma 错误，执行 `pnpm db:push` 同步 schema 后重试
