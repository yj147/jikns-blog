# 我的博客

![博客横幅](/public/static/images/twitter-card.png)

这是一个基于 [Next.js](https://nextjs.org/) 和 [Tailwind CSS](https://tailwindcss.com/) 构建的现代化博客。该项目基于优秀的开源模板 [tailwind-nextjs-starter-blog](https://github.com/timlrx/tailwind-nextjs-starter-blog)的二次开发。

## ✨ 特性

- **现代化技术栈**：Next.js 15 + React 19 + TypeScript
- **优雅的设计**：Tailwind CSS + 深色/浅色主题切换
- **中文优化**：完整的界面和字体支持
- **MDX 支持**：在 Markdown 中使用 React 组件
- **搜索功能**：内置 Kbar 搜索，支持中文内容搜索
- **响应式设计**：完美适配桌面端和移动端
- **SEO 友好**：完整的中文 SEO 优化
- **评论系统**：基于 Supabase 的自定义评论系统，支持匿名评论、用户登录评论、嵌套回复、垃圾过滤
- **用户认证**：完整的用户注册/登录系统，支持 OAuth（GitHub、Google）
- **数学公式**：KaTeX 数学公式渲染支持
- **代码高亮**：语法高亮和代码块功能
- **标签系统**：文章分类和标签管理
- **RSS 订阅**：自动生成 RSS 订阅源
- **性能优化**：接近满分的 Lighthouse 评分

## 🚀 快速开始

### 环境要求

- Node.js 18.17 或更高版本
- npm、yarn 或 pnpm

### 安装

1. 克隆项目

```bash
git clone https://github.com/yourusername/your-chinese-blog.git
cd your-chinese-blog
```

2. 安装依赖

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

3. 启动开发服务器

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

4. 配置 Supabase（评论系统和用户认证）

```bash
# 1. 创建 Supabase 项目
# 访问 https://app.supabase.com 创建新项目

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入 Supabase 配置

# 3. 初始化数据库
# 在 Supabase 控制台的 SQL Editor 中运行 database/supabase-init.sql

# 4. 测试连接
npm run test:supabase
```

5. 在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看效果

## 📝 配置

### 基本配置

编辑 `data/siteMetadata.js` 文件来配置您的博客信息：

```javascript
const siteMetadata = {
  title: '我的技术博客',
  author: '您的姓名',
  headerTitle: '技术分享',
  description: '基于 Next.js 和 Tailwind CSS 构建的博客',
  language: 'zh-cn',
  siteUrl: 'https://your-blog.com',
  // ... 其他配置
}
```

### 导航菜单

编辑 `data/headerNavLinks.ts` 来自定义导航菜单：

```typescript
const headerNavLinks = [
  { href: '/', title: '首页' },
  { href: '/blog', title: '博客' },
  { href: '/tags', title: '标签' },
  { href: '/projects', title: '项目' },
  { href: '/about', title: '关于' },
]
```

### 作者信息

编辑 `data/authors/default.mdx` 来设置作者信息：

```markdown
---
name: 您的姓名
avatar: /static/images/avatar.png
occupation: 您的职业
company: 您的公司
email: your-email@example.com
---

这里是您的个人介绍...
```

## ✍️ 写作

### 创建新文章

在 `data/blog/` 目录下创建新的 `.mdx` 文件：

```markdown
---
title: '文章标题'
date: '2025-06-21'
tags: ['标签1', '标签2']
draft: false
summary: '文章摘要'
---

# 文章内容

这里是您的文章内容...
```

### 支持的前置元数据

- `title`：文章标题（必需）
- `date`：发布日期（必需）
- `tags`：标签数组
- `draft`：是否为草稿
- `summary`：文章摘要
- `images`：文章图片
- `authors`：作者列表
- `layout`：布局模板

## 🎨 自定义

### 主题颜色

编辑 `css/tailwind.css` 文件来自定义主题颜色：

```css
@theme {
  --color-primary-500: oklch(0.656 0.241 354.308);
  /* 其他颜色配置 */
}
```

### 字体配置

项目已配置中文字体支持，使用 Noto Sans SC 作为中文字体。

### 布局模板

项目提供多种布局模板：

- `PostLayout`：默认文章布局
- `PostSimple`：简化文章布局
- `PostBanner`：带横幅的文章布局

## 📦 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 中导入项目
3. 配置环境变量（如果需要）
4. 部署完成

### 其他平台

项目支持部署到 Netlify、GitHub Pages 等平台。详细说明请参考 [部署文档](https://nextjs.org/docs/deployment)。

## 🔧 环境变量

创建 `.env.local` 文件来配置环境变量：

```bash
# Supabase 配置（自定义评论系统 + 用户认证）
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 可选：Supabase 服务角色密钥（用于管理员操作）
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# 应用配置
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_COMMENTS_ENABLED=true
NEXT_PUBLIC_ANONYMOUS_COMMENTS_ENABLED=true
NEXT_PUBLIC_USER_REGISTRATION_ENABLED=true

# 备用评论系统（Giscus）
NEXT_PUBLIC_GISCUS_REPO=
NEXT_PUBLIC_GISCUS_REPOSITORY_ID=
NEXT_PUBLIC_GISCUS_CATEGORY=
NEXT_PUBLIC_GISCUS_CATEGORY_ID=

# QQ登录配置
NEXT_PUBLIC_QQ_APP_ID=your_qq_app_id
QQ_APP_SECRET=your_qq_app_secret

# 分析工具
NEXT_UMAMI_ID=
```

### QQ登录配置说明

要启用QQ登录功能，需要：

1. **注册QQ互联开发者账号**
   - 访问 [QQ互联开放平台](https://connect.qq.com/)
   - 注册开发者账号并完成认证

2. **创建应用**
   - 在开发者中心创建网站应用
   - 获取 App ID 和 App Key
   - 配置回调地址：`https://yourdomain.com/auth/qq/callback`

3. **配置环境变量**
   ```bash
   NEXT_PUBLIC_QQ_APP_ID=你的QQ应用ID
   QQ_APP_SECRET=你的QQ应用密钥
   ```

4. **功能特性**
   - 与现有邮箱登录系统完全兼容
   - 自动创建用户账户并同步到Supabase
   - 支持用户头像和昵称同步
   - 统一的用户体验和界面设计

## 📚 技术栈

- **框架**：Next.js 15
- **UI 库**：React 19
- **样式**：Tailwind CSS 4
- **内容管理**：Contentlayer2
- **数据库**：Supabase (PostgreSQL)
- **认证**：Supabase Auth
- **语言**：TypeScript
- **部署**：Vercel

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT](LICENSE) © [您的姓名]

## 🙏 致谢

感谢 [Timothy Lin](https://github.com/timlrx) 创建的优秀模板 [tailwind-nextjs-starter-blog](https://github.com/timlrx/tailwind-nextjs-starter-blog)。
