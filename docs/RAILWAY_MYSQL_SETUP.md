# Railway MySQL 数据库设置指南

Railway 是目前最佳的免费 MySQL 托管选项，提供每月 $5 的免费额度，足够支持个人博客项目。

## 🚀 Railway 优势

- ✅ **每月 $5 免费额度** - 足够个人博客使用
- ✅ **MySQL 8.0 原生支持** - 无需修改代码
- ✅ **一键部署** - 设置简单快速
- ✅ **自动备份** - 数据安全有保障
- ✅ **高性能** - 全球 CDN 加速
- ✅ **监控面板** - 实时监控数据库状态

## 📋 设置步骤

### 1. 创建 Railway 账户

1. 访问 [Railway.app](https://railway.app)
2. 使用 GitHub 账户登录（推荐）
3. 验证邮箱地址

### 2. 创建 MySQL 数据库

1. 点击 "New Project"
2. 选择 "Provision MySQL"
3. 等待数据库创建完成（约 1-2 分钟）

### 3. 获取连接信息

在 Railway 控制台中：

1. 点击 MySQL 服务
2. 进入 "Variables" 标签页
3. 复制以下连接信息：
   - `MYSQL_HOST`
   - `MYSQL_PORT`
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`

### 4. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```bash
# Railway MySQL 配置
MYSQL_HOST=containers-us-west-xxx.railway.app
MYSQL_PORT=6543
MYSQL_USER=root
MYSQL_PASSWORD=your-generated-password
MYSQL_DATABASE=railway
```

### 5. 初始化数据库

#### 方法 A: 使用 Railway CLI（推荐）

1. 安装 Railway CLI：
```bash
npm install -g @railway/cli
```

2. 登录 Railway：
```bash
railway login
```

3. 连接到项目：
```bash
railway link
```

4. 执行初始化脚本：
```bash
railway run mysql -h $MYSQL_HOST -P $MYSQL_PORT -u $MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE < database/init.sql
```

#### 方法 B: 使用本地 MySQL 客户端

1. 安装 MySQL 客户端
2. 执行连接命令：
```bash
mysql -h containers-us-west-xxx.railway.app -P 6543 -u root -p railway < database/init.sql
```

### 6. 测试连接

运行测试脚本：
```bash
npm run test:mysql
```

如果看到以下输出，说明连接成功：
```
✅ 数据库连接成功!
✅ 查询测试成功: { test: 1 }
✅ comments 表已存在
📊 当前评论数量: 0
```

## 🔧 Railway 管理面板功能

### 数据库监控
- **CPU 使用率**: 实时监控数据库性能
- **内存使用**: 跟踪内存消耗
- **连接数**: 监控活跃连接
- **查询性能**: 分析慢查询

### 备份管理
- **自动备份**: 每日自动备份
- **手动备份**: 随时创建备份点
- **恢复功能**: 一键恢复到任意备份点

### 扩展选项
- **垂直扩展**: 增加 CPU/内存
- **存储扩展**: 增加磁盘空间
- **连接池**: 优化连接管理

## 💰 费用说明

### 免费额度
- **每月 $5 免费额度**
- **500MB 存储空间**
- **共享 CPU 资源**
- **无连接数限制**

### 典型使用量（个人博客）
- **数据库**: ~$2-3/月
- **存储**: ~$0.5/月
- **网络**: ~$0.5/月
- **总计**: ~$3-4/月（在免费额度内）

## 🛠️ 高级配置

### 连接池优化

在 `lib/mysql.ts` 中调整连接池设置：

```typescript
const dbConfig = {
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10, // Railway 推荐值
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  timezone: '+00:00',
}
```

### SSL 连接（生产环境推荐）

```typescript
const dbConfig = {
  // ... 其他配置
  ssl: {
    rejectUnauthorized: false // Railway 需要此设置
  }
}
```

## 🔍 故障排除

### 常见问题

1. **连接超时**
   - 检查防火墙设置
   - 确认 Railway 服务状态
   - 验证连接信息是否正确

2. **权限错误**
   - 确认用户名密码正确
   - 检查数据库名称
   - 验证用户权限

3. **SSL 错误**
   - 添加 SSL 配置
   - 设置 `rejectUnauthorized: false`

### 调试命令

```bash
# 测试网络连接
telnet containers-us-west-xxx.railway.app 6543

# 测试 MySQL 连接
mysql -h your-host -P your-port -u your-user -p

# 查看 Railway 日志
railway logs
```

## 📊 监控和维护

### 性能监控
- 定期检查 Railway 控制台
- 监控查询性能
- 跟踪存储使用量

### 数据备份
- 设置自动备份计划
- 定期测试恢复流程
- 导出重要数据

### 安全最佳实践
- 定期更新密码
- 限制数据库访问权限
- 启用 SSL 连接
- 监控异常访问

## 🚀 部署到生产环境

### Vercel 部署配置

在 Vercel 项目设置中添加环境变量：

```bash
MYSQL_HOST=containers-us-west-xxx.railway.app
MYSQL_PORT=6543
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DATABASE=railway
```

### 性能优化建议

1. **启用连接池**
2. **使用索引优化查询**
3. **定期清理过期数据**
4. **监控慢查询**

Railway 为您的博客评论系统提供了可靠、经济的 MySQL 托管解决方案！
