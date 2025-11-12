/**
 * 创建 Markdown 渲染测试文章的脚本
 */
import { PrismaClient } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

const markdownContent = `# 现代前端开发：React + TypeScript 最佳实践指南

在现代前端开发中，React 和 TypeScript 的组合已成为构建可维护、高性能 Web 应用的标准选择。本文将深入探讨这个技术栈的最佳实践，帮助开发者写出更优质的代码。

## 为什么选择 React + TypeScript？

### 1. 类型安全的优势

TypeScript 为 JavaScript 添加了静态类型系统，能够在编译时捕获错误：

\`\`\`typescript
interface User {
  id: number
  name: string
  email: string
  avatar?: string
}

// 类型安全的组件 props
interface UserCardProps {
  user: User
  onEdit: (userId: number) => void
}

const UserCard: React.FC<UserCardProps> = ({ user, onEdit }) => {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => onEdit(user.id)}>编辑</button>
    </div>
  )
}
\`\`\`

### 2. 更好的开发体验

- **智能提示**：IDE 能提供精准的代码补全
- **重构安全**：重命名变量时自动更新所有引用
- **错误预防**：在运行前就能发现潜在问题

## 核心概念与最佳实践

### 组件设计原则

#### 单一职责原则
每个组件应该只负责一个功能：

\`\`\`typescript
// ❌ 职责过多的组件
const UserDashboard = () => {
  // 用户信息管理
  // 数据获取
  // 表单验证
  // 路由跳转
  // ...
}

// ✅ 职责明确的组件
const UserProfile = () => { /* 只负责显示用户信息 */ }
const UserForm = () => { /* 只负责用户表单 */ }
const UserActions = () => { /* 只负责用户操作 */ }
\`\`\`

#### Props 接口设计
使用明确的 TypeScript 接口定义组件 props：

\`\`\`typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger'
  size: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  onClick
}) => {
  return (
    <button
      className={\`btn btn-\${variant} btn-\${size}\`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? '加载中...' : children}
    </button>
  )
}
\`\`\`

### 状态管理策略

#### 1. 本地状态 (useState)
适用于组件内部的简单状态：

\`\`\`typescript
const SearchInput: React.FC = () => {
  const [query, setQuery] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSearch = async (searchTerm: string) => {
    setIsLoading(true)
    try {
      // 执行搜索
      await searchAPI(searchTerm)
    } catch (error) {
      console.error('搜索失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入搜索关键词"
      />
      <button
        onClick={() => handleSearch(query)}
        disabled={isLoading}
      >
        搜索
      </button>
    </div>
  )
}
\`\`\`

#### 2. 上下文状态 (useContext)
适用于跨组件的状态共享：

\`\`\`typescript
interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
\`\`\`

### 性能优化技巧

#### 1. React.memo 防止不必要的重渲染

\`\`\`typescript
interface ListItemProps {
  item: {
    id: number
    title: string
    description: string
  }
  onSelect: (id: number) => void
}

const ListItem = React.memo<ListItemProps>(({ item, onSelect }) => {
  console.log(\`渲染 ListItem: \${item.id}\`)
  
  return (
    <div onClick={() => onSelect(item.id)}>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </div>
  )
})
\`\`\`

#### 2. useMemo 和 useCallback 优化计算

\`\`\`typescript
const ExpensiveComponent: React.FC<{ data: Item[] }> = ({ data }) => {
  // 缓存昂贵的计算结果
  const expensiveValue = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0)
  }, [data])

  // 缓存函数引用
  const handleItemClick = useCallback((id: number) => {
    console.log(\`点击了项目: \${id}\`)
  }, [])

  return (
    <div>
      <h2>总计: {expensiveValue}</h2>
      {data.map(item => (
        <ListItem
          key={item.id}
          item={item}
          onSelect={handleItemClick}
        />
      ))}
    </div>
  )
}
\`\`\`

## 错误处理与边界组件

### Error Boundary 实现

\`\`\`typescript
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary 捕获到错误:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>出现了意外错误</h2>
          <details>
            {this.state.error?.message}
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
\`\`\`

## 测试策略

### 单元测试示例

\`\`\`typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button 组件', () => {
  it('应该正确渲染按钮文本', () => {
    render(<Button>点击我</Button>)
    expect(screen.getByText('点击我')).toBeInTheDocument()
  })

  it('点击时应该调用 onClick 处理函数', () => {
    const mockOnClick = jest.fn()
    render(<Button onClick={mockOnClick}>点击我</Button>)
    
    fireEvent.click(screen.getByText('点击我'))
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('禁用状态下不应该触发点击事件', () => {
    const mockOnClick = jest.fn()
    render(<Button disabled onClick={mockOnClick}>点击我</Button>)
    
    fireEvent.click(screen.getByText('点击我'))
    expect(mockOnClick).not.toHaveBeenCalled()
  })
})
\`\`\`

## 工具链配置

### TypeScript 配置 (tsconfig.json)

\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["DOM", "DOM.Iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/utils/*": ["src/utils/*"]
    }
  },
  "include": [
    "src"
  ]
}
\`\`\`

### ESLint 配置

\`\`\`json
{
  "extends": [
    "@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "react/prop-types": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
\`\`\`

## 部署与优化

### 打包优化建议

1. **代码分割**：使用 React.lazy() 和 Suspense 实现路由级代码分割
2. **Tree Shaking**：移除未使用的代码
3. **Bundle 分析**：使用 webpack-bundle-analyzer 分析打包结果
4. **缓存策略**：合理配置文件缓存策略

### 性能监控

使用 React DevTools Profiler 和 Web Vitals 监控应用性能：

\`\`\`typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

// 监控核心性能指标
getCLS(console.log)
getFID(console.log)
getFCP(console.log)
getLCP(console.log)
getTTFB(console.log)
\`\`\`

## 总结

React + TypeScript 的组合为现代前端开发提供了强大的工具集。通过遵循本文介绍的最佳实践，您可以：

- ✅ 构建类型安全的应用
- ✅ 提升开发效率和代码质量
- ✅ 减少运行时错误
- ✅ 改善团队协作体验
- ✅ 构建可维护的大型应用

> **提示**：最佳实践是一个不断演进的过程。保持学习新的模式和工具，结合项目实际情况灵活应用。

---

*本文是基于实际项目经验总结的最佳实践，希望能帮助您在 React + TypeScript 的开发道路上更进一步。*

**标签**: React, TypeScript, 前端开发, 最佳实践, 性能优化

**相关文章**:
- [深入理解 React Hooks](/)
- [TypeScript 进阶技巧](/)
- [前端性能优化实战](/)
`

async function createDemoPost() {
  try {
    console.log("开始创建 Markdown 渲染测试文章...")

    // 首先获取管理员用户 ID
    const adminUser = await prisma.user.findFirst({
      where: {
        role: "ADMIN",
      },
    })

    if (!adminUser) {
      throw new Error("找不到管理员用户")
    }

    // 创建或获取标签 - 使用 findFirst 和 create 避免唯一约束冲突
    const tagData = [
      { name: "React", slug: "react", color: "#61DAFB" },
      { name: "TypeScript", slug: "typescript", color: "#3178C6" },
      { name: "前端开发", slug: "frontend", color: "#FF6B6B" },
      { name: "最佳实践", slug: "best-practices", color: "#4ECDC4" },
    ]

    const tags = []
    for (const tagInfo of tagData) {
      let tag = await prisma.tag.findFirst({
        where: {
          OR: [{ slug: tagInfo.slug }, { name: tagInfo.name }],
        },
      })

      if (!tag) {
        tag = await prisma.tag.create({
          data: tagInfo,
        })
      }

      tags.push(tag)
    }

    // 创建文章
    const post = await prisma.post.create({
      data: {
        slug: "react-typescript-best-practices-guide",
        title: "现代前端开发：React + TypeScript 最佳实践指南",
        content: markdownContent,
        excerpt:
          "深入探讨 React + TypeScript 技术栈的最佳实践，涵盖组件设计、状态管理、性能优化、错误处理、测试策略等核心话题，帮助开发者构建更优质的前端应用。",
        published: true,
        publishedAt: new Date(),
        authorId: adminUser.id,
        seoTitle: "React + TypeScript 最佳实践完全指南 | 现代前端开发",
        seoDescription:
          "学习 React + TypeScript 最佳实践，包括类型安全、组件设计、状态管理、性能优化等。适合中高级前端开发者的完整指南。",
        viewCount: 0,
        tags: {
          create: tags.map((tag) => ({
            tagId: tag.id,
          })),
        },
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    console.log("✅ 成功创建文章:", post.title)
    console.log("📝 文章 slug:", post.slug)
    console.log("🔗 访问链接: http://localhost:3999/blog/" + post.slug)
    console.log("🏷️  标签:", post.tags.map((pt) => pt.tag.name).join(", "))

    return post
  } catch (error) {
    console.error("❌ 创建文章失败:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createDemoPost()
  .then(() => {
    console.log("🎉 脚本执行完成")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 脚本执行失败:", error)
    process.exit(1)
  })
