# Supabase 迁移指南

本文档详细说明了如何将博客评论系统从 Vercel Postgres 迁移到 Supabase，并为未来的用户认证系统做好准备。

## 🎯 迁移目标

- ✅ 保持现有匿名评论功能
- ✅ 为未来用户登录系统做好准备
- ✅ 支持混合评论模式（匿名 + 登录用户）
- ✅ 提供完整的用户认证基础设施

## 📋 迁移步骤

### 1. 创建 Supabase 项目

1. 访问 [Supabase 控制台](https://app.supabase.com)
2. 点击 "New Project"
3. 填写项目信息：
   - **项目名称**: `jikns-blog-comments`
   - **数据库密码**: 生成强密码并保存
   - **区域**: 选择离用户最近的区域（推荐 Asia Pacific）
4. 等待项目创建完成（约 2-3 分钟）

### 2. 获取 Supabase 配置信息

在 Supabase 控制台中：

1. 进入 **Settings** → **API**
2. 复制以下信息：
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **Service role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (可选，用于管理员操作)

### 3. 配置环境变量

创建或更新 `.env.local` 文件：

```bash
# Supabase 配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 可选：管理员操作
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 应用配置
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_COMMENTS_ENABLED=true
NEXT_PUBLIC_ANONYMOUS_COMMENTS_ENABLED=true
NEXT_PUBLIC_USER_REGISTRATION_ENABLED=true
```

### 4. 初始化数据库

在 Supabase 控制台的 **SQL Editor** 中执行 `database/supabase-init.sql` 脚本：

1. 进入 **SQL Editor**
2. 点击 **New Query**
3. 复制 `database/supabase-init.sql` 的内容
4. 点击 **Run** 执行脚本

### 5. 安装依赖

```bash
npm install @supabase/supabase-js
```

### 6. 测试连接

```bash
npm run test:supabase
```

如果测试通过，你会看到：
```
🎉 Supabase 连接测试通过！
💡 接下来你可以：
   1. 启动开发服务器：npm run dev
   2. 访问博客页面测试评论功能
   3. 在 Supabase 控制台查看数据
```

## 🗄️ 数据库结构

### 用户表 (users)

```sql
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    website VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 评论表 (comments)

```sql
CREATE TABLE public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,
    
    -- 匿名用户信息
    author_name VARCHAR(100) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    author_website VARCHAR(500),
    
    -- 登录用户信息
    user_id UUID REFERENCES public.users(id),
    
    content TEXT NOT NULL,
    avatar_url VARCHAR(500),
    parent_id UUID REFERENCES public.comments(id),
    
    -- 评论状态
    is_anonymous BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔐 认证系统

### 基础认证组件

项目已包含以下认证组件：

- `components/auth/AuthProvider.tsx` - 认证上下文提供者
- `components/auth/LoginButton.tsx` - 登录按钮组件
- `app/auth/callback/page.tsx` - OAuth 回调页面

### 使用认证系统

1. **包装应用**：
```tsx
import { AuthProvider } from '@/components/auth/AuthProvider'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
```

2. **使用登录按钮**：
```tsx
import { LoginButton } from '@/components/auth/LoginButton'

export default function Header() {
  return (
    <header>
      <LoginButton />
    </header>
  )
}
```

3. **获取用户信息**：
```tsx
import { useAuth } from '@/components/auth/AuthProvider'

export default function CommentForm() {
  const { user, loading } = useAuth()
  
  if (loading) return <div>加载中...</div>
  
  return (
    <div>
      {user ? (
        <p>欢迎，{user.display_name}！</p>
      ) : (
        <p>请登录后评论</p>
      )}
    </div>
  )
}
```

## 🚀 OAuth 配置（可选）

### GitHub OAuth

1. 在 GitHub 创建 OAuth App：
   - 访问 GitHub Settings → Developer settings → OAuth Apps
   - 点击 "New OAuth App"
   - **Authorization callback URL**: `https://your-project-id.supabase.co/auth/v1/callback`

2. 在 Supabase 控制台配置：
   - 进入 **Authentication** → **Providers**
   - 启用 **GitHub**
   - 填入 Client ID 和 Client Secret

### Google OAuth

1. 在 Google Cloud Console 创建 OAuth 客户端
2. 在 Supabase 控制台配置 Google 提供商

## 📊 数据迁移

如果你有现有的评论数据需要迁移：

1. **导出现有数据**：
```sql
-- 从 Vercel Postgres 导出
SELECT * FROM comments ORDER BY created_at;
```

2. **转换数据格式**：
```sql
-- 在 Supabase 中插入（调整字段映射）
INSERT INTO public.comments (
  post_slug, author_name, author_email, author_website,
  content, avatar_url, parent_id, is_anonymous, is_approved,
  created_at, updated_at
) VALUES (...);
```

## 🔧 故障排除

### 常见问题

1. **连接失败**：
   - 检查环境变量是否正确
   - 确认 Supabase 项目已启用
   - 验证 API 密钥是否有效

2. **表不存在**：
   - 确保已运行 `database/supabase-init.sql`
   - 检查 SQL 脚本是否执行成功

3. **权限错误**：
   - 检查 RLS 策略是否正确配置
   - 确认用户角色权限

### 调试工具

- **Supabase 控制台**: 查看实时日志和数据
- **测试脚本**: `npm run test:supabase`
- **浏览器开发者工具**: 检查网络请求和错误

## 📈 性能优化

1. **数据库索引**：已在初始化脚本中创建必要索引
2. **查询优化**：使用 Supabase 的查询构建器
3. **缓存策略**：考虑使用 Redis 或 Vercel KV 缓存热门评论

## 🔮 未来扩展

迁移到 Supabase 后，你可以轻松添加：

- ✅ 用户注册/登录系统
- ✅ OAuth 第三方登录
- ✅ 用户个人资料管理
- ✅ 评论点赞/回复通知
- ✅ 实时评论更新
- ✅ 文件上传（头像、附件）
- ✅ 高级权限管理

## 📞 支持

如果在迁移过程中遇到问题：

1. 查看 [Supabase 官方文档](https://supabase.com/docs)
2. 检查项目的 GitHub Issues
3. 运行测试脚本诊断问题
