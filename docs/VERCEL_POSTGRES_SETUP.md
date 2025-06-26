# Vercel Postgres 设置指南

Vercel Postgres 是与 Vercel 深度集成的 PostgreSQL 数据库解决方案，为您的博客评论系统提供最佳性能和开发体验。

## 🚀 Vercel Postgres 优势

- ✅ **零配置集成** - 与 Vercel 项目无缝集成
- ✅ **全球边缘优化** - 自动选择最近的数据库实例
- ✅ **自动扩展** - 根据流量自动调整资源
- ✅ **统一控制台** - 在 Vercel 控制台统一管理
- ✅ **免费额度充足** - 个人博客完全够用
- ✅ **内置监控** - 实时性能和错误监控

## 💰 免费额度

- **数据库存储**: 256MB
- **每月查询**: 10,000 次
- **并发连接**: 20 个
- **备份保留**: 7 天
- **全球边缘**: 无限制访问

## 📋 设置步骤

### 1. 创建 Vercel Postgres 数据库

1. 登录 [Vercel 控制台](https://vercel.com/dashboard)
2. 进入您的项目
3. 点击 "Storage" 标签页
4. 点击 "Create Database"
5. 选择 "Postgres"
6. 输入数据库名称（如：`blog-comments`）
7. 选择区域（建议选择离用户最近的区域）
8. 点击 "Create"

### 2. 连接数据库到项目

1. 在数据库创建完成后，点击 "Connect Project"
2. 选择您的 Next.js 项目
3. Vercel 会自动注入环境变量到项目中

### 3. 初始化数据库

#### 方法 A: 使用 Vercel CLI（推荐）

1. 安装 Vercel CLI：
```bash
npm install -g vercel
```

2. 登录 Vercel：
```bash
vercel login
```

3. 链接项目：
```bash
vercel link
```

4. 执行数据库初始化：
```bash
vercel env pull .env.local
psql $POSTGRES_URL < database/init.sql
```

#### 方法 B: 使用 Vercel 控制台

1. 在 Vercel 控制台中进入数据库
2. 点击 "Query" 标签页
3. 复制 `database/init.sql` 的内容
4. 粘贴到查询编辑器中
5. 点击 "Run Query"

### 4. 验证安装

运行测试脚本：
```bash
npm run test:postgres
```

如果看到以下输出，说明设置成功：
```
✅ 数据库连接成功!
✅ 查询测试成功
✅ comments 表已存在
📊 当前评论数量: 0
```

## 🔧 环境变量

Vercel 会自动注入以下环境变量：

```bash
# Vercel Postgres 自动注入的变量
POSTGRES_URL="postgres://..."
POSTGRES_PRISMA_URL="postgres://..."
POSTGRES_URL_NON_POOLING="postgres://..."
POSTGRES_USER="..."
POSTGRES_HOST="..."
POSTGRES_PASSWORD="..."
POSTGRES_DATABASE="..."
```

您无需手动配置这些变量，Vercel 会自动管理。

## 📊 Vercel 控制台功能

### 数据库监控
- **查询性能**: 实时查询执行时间
- **连接数**: 当前活跃连接监控
- **存储使用**: 数据库大小跟踪
- **错误日志**: 自动错误收集

### 查询编辑器
- **SQL 查询**: 直接在浏览器中执行 SQL
- **结果预览**: 表格形式显示查询结果
- **查询历史**: 保存常用查询
- **语法高亮**: SQL 语法高亮支持

### 备份管理
- **自动备份**: 每日自动备份
- **手动备份**: 随时创建备份点
- **恢复功能**: 一键恢复到任意时间点

## 🚀 部署配置

### 自动部署

当您推送代码到 GitHub 时，Vercel 会：

1. 自动构建项目
2. 注入数据库环境变量
3. 部署到全球边缘网络
4. 自动配置数据库连接

### 环境隔离

Vercel 支持多环境部署：

- **Production**: 生产环境数据库
- **Preview**: 预览环境（可选独立数据库）
- **Development**: 本地开发环境

## 🔍 性能优化

### 连接池优化

Vercel Postgres 自动管理连接池，无需手动配置。

### 查询优化

```typescript
// 使用索引优化查询
const comments = await db`
  SELECT * FROM comments 
  WHERE post_slug = ${slug} AND is_approved = true
  ORDER BY created_at DESC
`

// 批量操作
const results = await db`
  INSERT INTO comments (post_slug, author_name, content)
  SELECT * FROM UNNEST(
    ${postSlugs}::text[],
    ${authorNames}::text[],
    ${contents}::text[]
  )
`
```

### 边缘优化

Vercel Postgres 自动：
- 选择最近的数据库实例
- 缓存频繁查询
- 优化网络延迟

## 🛠️ 故障排除

### 常见问题

1. **连接失败**
   - 检查 Vercel 项目是否正确链接数据库
   - 确认环境变量已正确注入
   - 验证数据库状态

2. **查询超时**
   - 检查查询复杂度
   - 确认索引是否正确创建
   - 监控并发连接数

3. **权限错误**
   - 确认数据库用户权限
   - 检查表和函数的访问权限

### 调试工具

```bash
# 检查环境变量
vercel env ls

# 查看部署日志
vercel logs

# 本地开发调试
vercel dev
```

## 📈 监控和维护

### 性能监控
- 在 Vercel 控制台查看实时指标
- 设置查询性能告警
- 监控存储使用量

### 数据维护
- 定期清理过期数据
- 优化数据库索引
- 监控备份状态

## 🔒 安全最佳实践

- **自动 SSL**: Vercel 自动处理 SSL 连接
- **网络隔离**: 数据库仅对 Vercel 项目可见
- **访问控制**: 基于项目的访问权限
- **审计日志**: 自动记录数据库访问

## 🎯 与其他方案对比

| 特性 | Vercel Postgres | Railway MySQL | 本地 MySQL |
|------|-----------------|---------------|------------|
| **集成度** | ✅ 完美集成 | 需要配置 | 需要配置 |
| **性能** | ✅ 全球边缘 | 单区域 | 本地最快 |
| **维护** | ✅ 零维护 | 低维护 | 高维护 |
| **扩展性** | ✅ 自动扩展 | 手动扩展 | 手动扩展 |
| **成本** | ✅ 慷慨免费额度 | $5/月免费 | 完全免费 |

Vercel Postgres 为您的博客评论系统提供了最佳的性能、可靠性和开发体验！
