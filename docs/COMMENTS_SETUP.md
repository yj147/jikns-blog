# 自定义评论系统设置指南 (Vercel Postgres 版本)

本项目已集成基于 Vercel Postgres 的自定义评论系统，支持匿名评论、回复功能、垃圾评论过滤等特性。

## 功能特性

- ✅ **匿名评论**：无需注册，填写姓名和邮箱即可评论
- ✅ **嵌套回复**：支持对评论进行回复，形成讨论串
- ✅ **头像显示**：自动生成 Gravatar 头像
- ✅ **垃圾过滤**：内置垃圾评论检测机制
- ✅ **用户信息记忆**：使用 localStorage 记住用户信息
- ✅ **响应式设计**：完美适配桌面和移动端
- ✅ **深色主题**：支持深色/浅色主题切换
- ✅ **实时更新**：评论提交后自动刷新列表

## 数据库设置

### 1. 准备 MySQL 数据库

您可以选择以下任一方式：

#### 选项 A: 使用 PlanetScale (推荐)
1. 访问 [PlanetScale](https://planetscale.com) 并创建免费账户
2. 创建新数据库
3. 获取连接字符串

#### 选项 B: 使用本地 MySQL
1. 安装 MySQL 8.0+
2. 创建数据库用户和数据库

#### 选项 C: 使用 Railway
1. 访问 [Railway](https://railway.app)
2. 部署 MySQL 服务
3. 获取连接信息

### 2. 执行数据库初始化

使用 MySQL 客户端或管理工具执行 `database/init.sql` 文件：

```sql
-- 创建数据库
CREATE DATABASE IF NOT EXISTS blog_comments
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 创建评论表
CREATE TABLE IF NOT EXISTS comments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  post_slug VARCHAR(255) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  author_website VARCHAR(255) NULL,
  content TEXT NOT NULL,
  avatar_url VARCHAR(500) NULL,
  parent_id CHAR(36) NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. 配置环境变量

创建 `.env.local` 文件并添加以下配置：

```bash
# MySQL 数据库配置
MYSQL_HOST=your-mysql-host
MYSQL_PORT=3306
MYSQL_USER=your-username
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=blog_comments
```

#### PlanetScale 配置示例：
```bash
MYSQL_HOST=aws.connect.psdb.cloud
MYSQL_PORT=3306
MYSQL_USER=your-username
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=your-database-name
```

## 使用方法

### 1. 安装依赖

```bash
npm install mysql2 crypto-js zod
# 或
yarn add mysql2 crypto-js zod
```

### 2. 启用自定义评论系统

在 `data/siteMetadata.js` 中确保评论配置为：

```javascript
comments: {
  provider: 'custom', // 使用自定义评论系统
  customConfig: {
    enabled: true,
    moderation: true,
    maxLength: 2000,
    allowAnonymous: true,
  },
}
```

### 3. 测试评论功能

1. 启动开发服务器：`npm run dev`
2. 访问任意博客文章页面
3. 在页面底部找到评论区域
4. 填写表单并提交评论

## API 接口

### GET /api/comments/[slug]

获取指定文章的评论列表

**响应示例：**
```json
{
  "success": true,
  "comments": [
    {
      "id": "uuid",
      "author_name": "用户名",
      "content": "评论内容",
      "created_at": "2025-01-01T00:00:00Z",
      "replies": []
    }
  ],
  "total": 1
}
```

### POST /api/comments

提交新评论

**请求体：**
```json
{
  "post_slug": "article-slug",
  "author_name": "用户名",
  "author_email": "user@example.com",
  "author_website": "https://example.com",
  "content": "评论内容",
  "parent_id": "uuid" // 可选，回复评论时使用
}
```

## 安全特性

### 垃圾评论过滤

系统内置垃圾评论检测，包括：

- 关键词过滤
- 链接数量限制
- 重复字符检测
- 可疑内容标记

### 数据验证

- 使用 Zod 进行严格的数据验证
- 防止 XSS 攻击
- 邮箱格式验证
- 内容长度限制

### 数据库安全

- 启用行级安全策略 (RLS)
- 只允许读取已批准的评论
- 防止 SQL 注入攻击

## 管理功能

### 评论审核

垃圾评论会自动标记为需要审核（`is_approved = false`），管理员可以在 Supabase 控制台中：

1. 查看待审核评论
2. 批准或删除评论
3. 管理用户黑名单

### 数据备份

建议定期备份 Supabase 数据库，确保评论数据安全。

## 故障排除

### 常见问题

1. **评论不显示**
   - 检查环境变量配置
   - 确认数据库表已创建
   - 查看浏览器控制台错误

2. **提交失败**
   - 检查网络连接
   - 验证表单数据格式
   - 查看服务器日志

3. **样式问题**
   - 确认 Tailwind CSS 正常加载
   - 检查深色主题配置

### 调试模式

在开发环境中，可以在浏览器控制台查看详细的错误信息和 API 响应。

## 自定义配置

### 修改样式

评论系统的样式定义在 `css/tailwind.css` 中，可以根据需要进行自定义。

### 调整功能

- 修改 `lib/supabase.ts` 中的类型定义
- 调整 `app/api/comments/route.ts` 中的验证规则
- 自定义 `components/CommentForm.tsx` 中的表单字段

## 迁移指南

### 从 Giscus 迁移

如果之前使用 Giscus，可以：

1. 保留原有配置作为备用
2. 修改 `provider` 为 `custom`
3. 导出 GitHub Discussions 数据（可选）
4. 测试新评论系统

### 数据导入

如果需要从其他评论系统导入数据，可以编写脚本将数据转换为 Supabase 表格式。
