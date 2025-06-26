# 用户认证系统使用指南

本文档详细说明了如何使用博客的用户认证系统，包括组件使用、集成方法和自定义选项。

## 🎯 功能概览

- ✅ **用户注册/登录** - 邮箱密码 + OAuth（GitHub、Google）
- ✅ **用户资料管理** - 头像、显示名称、个人简介等
- ✅ **会话管理** - 自动会话保持和状态同步
- ✅ **权限控制** - 基于用户状态的内容访问控制
- ✅ **响应式设计** - 完美适配桌面和移动端
- ✅ **深色模式支持** - 与博客主题一致

## 🚀 快速开始

### 1. 包装应用

在根布局中包装 `AuthProvider`：

```tsx
// app/layout.tsx
import { AuthProvider } from '@/components/auth'

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

### 2. 添加用户菜单

在导航栏中添加用户菜单：

```tsx
// components/Header.tsx
import { UserMenu } from '@/components/auth'

export default function Header() {
  return (
    <header className="flex justify-between items-center">
      <div>Logo</div>
      <nav className="flex items-center space-x-4">
        <a href="/blog">博客</a>
        <a href="/about">关于</a>
        <UserMenu />
      </nav>
    </header>
  )
}
```

### 3. 在评论系统中集成

```tsx
// components/comments/CommentForm.tsx
import { useAuth } from '@/components/auth'

export default function CommentForm() {
  const { user, loading } = useAuth()

  if (loading) return <div>加载中...</div>

  return (
    <div>
      {user ? (
        <div>
          <p>欢迎，{user.display_name}！</p>
          {/* 登录用户的评论表单 */}
        </div>
      ) : (
        <div>
          {/* 匿名用户的评论表单 */}
          <p>您可以匿名评论，或 <button>登录</button> 后评论</p>
        </div>
      )}
    </div>
  )
}
```

## 📦 组件详解

### AuthProvider

认证上下文提供者，管理全局认证状态。

```tsx
import { AuthProvider, useAuth } from '@/components/auth'

// 使用认证状态
function MyComponent() {
  const { user, session, loading, signIn, signUp, signOut } = useAuth()
  
  return (
    <div>
      {user ? `欢迎，${user.display_name}` : '请登录'}
    </div>
  )
}
```

**API：**
- `user`: 当前用户信息
- `session`: Supabase 会话对象
- `loading`: 认证状态加载中
- `signIn(email, password)`: 邮箱密码登录
- `signUp(email, password, metadata)`: 用户注册
- `signOut()`: 用户登出
- `signInWithOAuth(provider)`: OAuth 登录

### UserMenu

用户菜单组件，显示登录状态和用户操作。

```tsx
import { UserMenu } from '@/components/auth'

<UserMenu className="ml-4" />
```

**特性：**
- 未登录时显示登录/注册按钮
- 已登录时显示用户头像和下拉菜单
- 包含个人资料、设置、登出等选项

### AuthModal

登录/注册模态框组件。

```tsx
import { AuthModal } from '@/components/auth'

function MyComponent() {
  const [showAuth, setShowAuth] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowAuth(true)}>登录</button>
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        defaultTab="login" // 或 "register"
      />
    </>
  )
}
```

**Props：**
- `isOpen`: 是否显示模态框
- `onClose`: 关闭回调函数
- `defaultTab`: 默认标签页（'login' | 'register'）

### UserAvatar

用户头像组件，支持多种尺寸和样式。

```tsx
import { UserAvatar } from '@/components/auth'

// 显示当前用户头像
<UserAvatar user={user} size="lg" showName />

// 显示任意用户头像
<UserAvatar 
  email="user@example.com" 
  name="用户名" 
  size="md" 
/>
```

**Props：**
- `user`: 用户对象
- `email`: 邮箱地址（用于生成 Gravatar）
- `name`: 显示名称
- `size`: 尺寸（'sm' | 'md' | 'lg' | 'xl'）
- `showName`: 是否显示名称
- `className`: 自定义样式类

### UserProfile

用户个人资料组件，支持查看和编辑。

```tsx
import { UserProfile } from '@/components/auth'

// 在个人资料页面使用
<UserProfile className="max-w-4xl mx-auto" />
```

**特性：**
- 显示用户基本信息
- 支持在线编辑个人资料
- 头像、显示名称、个人简介、网站等
- 账户信息展示

## 🔐 权限控制

### 基于用户状态的内容控制

```tsx
import { useAuth } from '@/components/auth'

function ProtectedContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>加载中...</div>
  }

  if (!user) {
    return <div>请登录后查看此内容</div>
  }

  return (
    <div>
      <h2>受保护的内容</h2>
      <p>只有登录用户才能看到这里</p>
    </div>
  )
}
```

### 基于用户角色的权限控制

```tsx
function AdminPanel() {
  const { user } = useAuth()

  // 检查用户是否为管理员
  const isAdmin = user?.email === 'admin@example.com' // 简单示例

  if (!isAdmin) {
    return <div>权限不足</div>
  }

  return <div>管理员面板</div>
}
```

## 🎨 自定义样式

### 主题定制

所有组件都支持深色模式，并使用 Tailwind CSS 类进行样式控制：

```tsx
// 自定义用户菜单样式
<UserMenu className="bg-white dark:bg-gray-800 rounded-lg shadow-lg" />

// 自定义头像样式
<UserAvatar 
  user={user} 
  className="ring-2 ring-primary-500 ring-offset-2" 
/>
```

### CSS 变量

可以通过 CSS 变量自定义主色调：

```css
:root {
  --color-primary-500: #3b82f6;
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
}
```

## 🔧 高级配置

### OAuth 提供商配置

在 Supabase 控制台中配置 OAuth 提供商：

1. **GitHub OAuth**：
   - 在 GitHub 创建 OAuth App
   - 设置回调 URL：`https://your-project.supabase.co/auth/v1/callback`
   - 在 Supabase 中配置 Client ID 和 Secret

2. **Google OAuth**：
   - 在 Google Cloud Console 创建 OAuth 客户端
   - 在 Supabase 中配置相应信息

### 自定义认证流程

```tsx
import { supabase } from '@/lib/supabase'

// 自定义登录逻辑
async function customSignIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // 自定义错误处理
    console.error('Login failed:', error)
    return { success: false, error: error.message }
  }

  // 自定义成功处理
  console.log('Login successful:', data)
  return { success: true, user: data.user }
}
```

## 📱 移动端适配

所有组件都已针对移动端进行优化：

- 响应式布局
- 触摸友好的交互
- 适配小屏幕的模态框
- 移动端优化的菜单

## 🐛 故障排除

### 常见问题

1. **认证状态不同步**：
   - 确保 `AuthProvider` 正确包装了应用
   - 检查 Supabase 配置是否正确

2. **OAuth 登录失败**：
   - 检查 OAuth 提供商配置
   - 确认回调 URL 设置正确

3. **头像不显示**：
   - 检查图片 URL 是否有效
   - 确认 Gravatar 邮箱是否正确

### 调试工具

```tsx
// 添加调试信息
function DebugAuth() {
  const { user, session, loading } = useAuth()
  
  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded text-xs">
      <div>Loading: {loading.toString()}</div>
      <div>User: {user ? user.email : 'null'}</div>
      <div>Session: {session ? 'active' : 'null'}</div>
    </div>
  )
}
```

## 🚀 最佳实践

1. **性能优化**：
   - 使用 `loading` 状态显示加载指示器
   - 避免在认证状态未确定时渲染敏感内容

2. **用户体验**：
   - 提供清晰的错误消息
   - 支持键盘导航
   - 保持一致的视觉反馈

3. **安全性**：
   - 始终在服务端验证用户权限
   - 使用 HTTPS 传输敏感信息
   - 定期更新依赖项

## 📚 相关文档

- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)
- [React Context 最佳实践](https://react.dev/learn/passing-data-deeply-with-context)
- [Tailwind CSS 组件](https://tailwindui.com/components)
