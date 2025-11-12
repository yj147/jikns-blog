# 技术栈深度分析

基于实际配置文件和架构文档的详细技术栈分析。

## 核心架构层次

### 1. 运行时基础

- **Node.js**: 22.x LTS (最新长期支持版本)
- **包管理器**: pnpm 9.12+ (强制要求，性能和磁盘优化)
- **TypeScript**: 5.9.2 (严格模式，完整类型安全)

### 2. 前端框架栈

- **Next.js**: 15.5.0 (App Router 架构)
  - 服务端组件优先
  - 文件系统路由
  - 内置优化 (图片、字体、代码分割)
- **React**: 19.1.1 (最新稳定版)
  - Hooks 为主的函数式组件
  - 并发特性支持

### 3. 后端基础设施 (BaaS 模式)

- **Supabase**: 全栈后端服务
  - PostgreSQL 17 数据库
  - 实时订阅功能
  - Row Level Security (RLS)
  - 认证服务 (GitHub OAuth + Email/Password)
  - 文件存储服务
- **Prisma**: 6.14.0 ORM
  - 类型安全的数据库访问
  - 自动生成 TypeScript 类型
  - 迁移管理
  - 数据库内省

## UI/UX 技术栈

### 4. 样式系统

- **Tailwind CSS**: 4.1.x (最新版本)
  - 实用优先的 CSS 框架
  - JIT 编译优化
  - 自定义设计系统
- **PostCSS**: 配置化 CSS 处理
- **CSS 变量**: 主题和暗黑模式支持

### 5. 组件库生态

- **shadcn/ui**: 现代 React 组件集合
  - 基于 Radix UI 无障碍组件
  - 完全可定制的源码组件
  - TypeScript 完整支持
- **Radix UI**: 25+ 无障碍原始组件
  - WCAG 兼容
  - 键盘导航支持
  - 焦点管理
- **Lucide React**: 图标库 (Tree-shaking 优化)
- **Framer Motion**: 12.23.x 动画库
  - 声明式动画 API
  - 手势和拖拽支持
  - SVG 动画

## 开发工具链

### 6. 测试生态系统

- **Vitest**: 2.1.9 (现代测试运行器)
  - 基于 Vite 的快速测试
  - ESM 原生支持
  - TypeScript 开箱即用
- **React Testing Library**: 16.3.0
  - 用户行为导向的测试
  - 无障碍性测试支持
- **Playwright**: 1.49.1
  - 跨浏览器 E2E 测试
  - 自动等待和重试
  - 视觉回归测试

### 7. 代码质量工具

- **ESLint**: 8.57.1
  - Next.js 规则集成
  - React Hooks 规则
  - TypeScript 集成
  - 无障碍性规则
- **Prettier**: 3.1.1
  - Tailwind CSS 类排序插件
  - 一致的代码格式化
- **Husky**: 9.1.7 + lint-staged
  - Git hooks 自动化
  - 提交前质量检查

### 8. 构建和优化

- **Next.js 内置优化**:
  - 自动代码分割
  - 图片优化 (WebP, AVIF)
  - 字体优化 (Google Fonts)
  - Tree-shaking
- **Webpack 自定义配置**:
  - Prisma 客户端优化
  - Lucide 图标 Tree-shaking
  - Bundle 分析和缓存策略

## 数据层架构

### 9. 数据库设计

- **PostgreSQL 17**: 现代关系型数据库
  - JSON/JSONB 支持
  - 全文搜索功能
  - 高级索引类型
- **数据模型**: 11 个核心实体
  - User: 用户基础信息和认证
  - Post: 博客文章内容
  - Activity: 社交动态
  - Comment/Like: 通用交互模型 (多态关联)
  - Tag/Series: 内容组织
  - Follow/Bookmark: 社交功能

### 10. 状态管理

- **React 内置状态**: useState, useReducer
- **服务器状态**: SWR 2.3.6 (数据获取和缓存)
- **表单状态**: React Hook Form 7.60.0
  - 类型安全的表单处理
  - Zod schema 验证集成

## 安全和认证

### 11. 认证架构

- **双重认证支持**:
  - GitHub OAuth (社交登录)
  - Email/Password (传统认证)
- **会话管理**: Supabase Auth
  - JWT Token 自动刷新
  - 安全的 Cookie 存储
- **权限控制**:
  - 基于角色 (ADMIN/USER)
  - 基于状态 (ACTIVE/BANNED)
  - Row Level Security (RLS) 数据库层面

### 12. 安全最佳实践

- **内容安全策略 (CSP)**: Next.js 配置
- **HTTPS 强制**: 生产环境 HSTS
- **XSS 防护**: React 自动转义 + DOMPurify
- **CSRF 防护**: SameSite Cookie 策略
- **输入验证**: Zod schema 端到端验证

## 性能优化策略

### 13. 前端性能

- **代码分割**: 路由级和组件级
- **图片优化**: Next.js Image 组件 + WebP/AVIF
- **字体优化**: 自动字体预加载
- **缓存策略**: SWR 客户端缓存 + HTTP 缓存头

### 14. 数据库性能

- **查询优化**: Prisma 查询分析器
- **索引策略**: 基于查询模式的索引设计
- **连接池**: Supabase 自动管理
- **实时功能**: PostgreSQL 的 LISTEN/NOTIFY

## 开发体验优化

### 15. 本地开发环境

- **Supabase CLI**: 完整本地后端栈
  - 本地 PostgreSQL 实例
  - 本地认证服务
  - 本地文件存储
  - Studio 管理界面
- **热重载**: Next.js 快速刷新
- **类型安全**: 端到端 TypeScript 类型推导

### 16. 调试和监控

- **开发工具**:
  - React Developer Tools
  - Prisma Studio (数据库可视化)
  - Supabase Studio (后端管理)
- **错误处理**: 统一错误边界和日志系统
- **性能监控**: Web Vitals 集成

## 部署和基础设施

### 17. 部署策略

- **平台**: Vercel (Next.js 原生优化)
- **数据库**: Supabase Cloud (生产环境)
- **CDN**: 全球边缘网络
- **环境管理**: Preview 部署 + 生产环境

### 18. CI/CD 流程

- **Git Hooks**: 代码质量自动检查
- **测试自动化**: PR 触发完整测试套件
- **部署自动化**: 主分支自动部署

## 可扩展性考虑

### 19. 架构可扩展性

- **组件驱动开发**: 可重用的 UI 组件库
- **模块化数据层**: 清晰的数据模型关系
- **微服务就绪**: BaaS 架构便于服务拆分

### 20. 性能扩展性

- **数据库扩展**: PostgreSQL 垂直/水平扩展
- **CDN 和缓存**: 静态资源全球分发
- **服务器渲染**: 减少客户端计算负担
