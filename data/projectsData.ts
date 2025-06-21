interface Project {
  title: string
  description: string
  href?: string
  imgSrc?: string
}

const projectsData: Project[] = [
  {
    title: '个人技术博客',
    description: `基于 Next.js 和 Tailwind CSS 构建的现代化技术博客。支持 MDX、深色模式、
    搜索功能、评论系统等特性。分享前端开发、后端技术和编程心得。`,
    imgSrc: '/static/images/blog.png',
    href: '/blog/welcome-to-chinese-blog',
  },
  {
    title: 'React 组件库',
    description: `一个基于 TypeScript 和 Tailwind CSS 的现代化 React 组件库。
    包含常用的 UI 组件，支持主题定制，提供完整的文档和示例。`,
    imgSrc: '/static/images/react.png',
    href: 'https://github.com/yourusername/react-components',
  },
  {
    title: '全栈电商应用',
    description: `使用 Next.js、Prisma 和 PostgreSQL 构建的全栈电商应用。
    包含用户认证、商品管理、购物车、支付集成等完整功能。`,
    imgSrc: '/static/images/shop.png',
    href: 'https://github.com/yourusername/ecommerce-app',
  },
]

export default projectsData
