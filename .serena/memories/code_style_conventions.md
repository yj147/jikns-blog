# 代码风格和约定

## 语言和文件约定

### 代码语言使用

- **注释语言**: 中文
- **变量/函数/类名**: 英文 (camelCase/PascalCase)
- **文件名**: kebab-case 或 camelCase (遵循 Next.js 约定)
- **技术术语**: 保持英文原文 (如 Supabase, Prisma, React 等)

### 文件组织

- **页面**: `/app/` 目录，使用 App Router 约定
- **组件**: `/components/` 目录，按功能模块划分
- **工具函数**: `/lib/` 目录
- **Hook**: `/hooks/` 目录
- **类型**: `/types/` 目录
- **测试**: `/tests/` 目录，镜像源码结构

## TypeScript 约定

### 类型定义

- 优先使用 interface 而不是 type (除非需要联合类型)
- 导出类型时使用 PascalCase 命名
- 使用 Prisma 生成的类型作为基础，避免重复定义

### 命名约定

- 组件: PascalCase (如 `UserProfile`, `BlogPost`)
- 函数: camelCase (如 `getUserData`, `createPost`)
- 常量: UPPER_SNAKE_CASE (如 `API_BASE_URL`)
- 枚举: PascalCase (如 `UserRole`, `PostStatus`)

## React 组件约定

### 组件结构

```tsx
// 导入顺序：React -> 第三方库 -> 本地组件 -> 类型
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserProfile } from './user-profile'
import type { User } from '@/types'

interface ComponentProps {
  user: User
  onUpdate?: (user: User) => void
}

export function ComponentName({ user, onUpdate }: ComponentProps) {
  // 组件逻辑
  return (
    // JSX
  )
}
```

### 组件命名

- 文件名使用 kebab-case: `user-profile.tsx`
- 组件名使用 PascalCase: `UserProfile`
- 导出使用命名导出: `export function UserProfile`

## 数据库和 API 约定

### Prisma Schema 约定

- 模型名使用 PascalCase: `User`, `BlogPost`
- 字段名使用 camelCase: `userId`, `createdAt`
- 关系字段明确命名: `author`, `comments`, `likes`

### API 路由约定

- 使用 RESTful 设计
- 文件名: `/app/api/posts/route.ts`
- HTTP 方法对应 CRUD 操作

### 数据库命名

- 表名: PascalCase (由 Prisma 自动处理)
- 列名: camelCase
- 索引名: 描述性命名

## 测试约定

### 测试文件命名

- 单元测试: `component-name.test.tsx`
- 集成测试: `feature-name.test.ts`
- E2E 测试: `user-flow.spec.ts`

### 测试结构

```typescript
describe("ComponentName", () => {
  describe("when user is authenticated", () => {
    it("should display user profile", () => {
      // 测试逻辑
    })
  })
})
```

## CSS 和样式约定

### Tailwind CSS 使用

- 优先使用 Tailwind 实用类
- 复杂样式使用 CSS 模块或 styled-components
- 响应式设计: mobile-first 方法

### 组件样式

- 使用 `clsx` 进行条件样式
- 使用 `cn()` 工具函数 (来自 shadcn/ui)

## Git 和提交约定

### 提交信息格式

```
类型(范围): 简短描述

详细描述 (可选)

相关问题: #123
```

### 提交类型

- `feat`: 新功能
- `fix`: 错误修复
- `docs`: 文档变更
- `style`: 代码格式 (不影响功能)
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

### 分支命名

- 功能分支: `feature/user-authentication`
- 修复分支: `fix/login-error`
- 重构分支: `refactor/api-structure`

## 代码质量工具

### ESLint 规则

- 使用项目配置的 ESLint 规则
- 自动修复: `pnpm lint`
- 检查: `pnpm lint:check`

### Prettier 格式化

- 自动格式化: `pnpm format`
- 检查格式: `pnpm format:check`

### TypeScript 检查

- 类型检查: `pnpm type-check`
- 严格模式启用

## 安全和最佳实践

### 安全约定

- 敏感信息存储在环境变量中
- 输入验证使用 Zod schema
- SQL 注入防护 (Prisma 自动处理)
- XSS 防护使用适当的转义

### 性能约定

- 图片优化使用 Next.js Image 组件
- 代码分割使用动态导入
- 状态管理优先使用 React 内置 hooks

### 可访问性

- 使用语义化 HTML
- 适当的 ARIA 属性
- 键盘导航支持
- 颜色对比度符合 WCAG 标准
