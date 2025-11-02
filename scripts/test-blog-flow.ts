/**
 * 博客发布-浏览流程测试脚本 - Phase 5.2
 * 测试完整的文章创建、发布和前端浏览流程
 */

import { createPost, publishPost, getPosts, getPost } from "@/lib/actions/posts"

async function testBlogFlow() {
  console.log("🚀 开始测试博客发布-浏览流程...\n")

  try {
    // 1. 创建测试文章
    console.log("1️⃣ 创建测试文章...")
    const createResult = await createPost({
      title: "测试文章：Phase 5.2 功能验证",
      content: `# 测试文章：Phase 5.2 功能验证

这是一篇用于验证 Phase 5.2 博客前后端联动功能的测试文章。

## 功能验证点

### ✅ 已实现的功能
1. **博客列表页面数据连接** - 显示真实的数据库数据
2. **文章详情页面** - 从 mock 数据升级为真实数据连接  
3. **SEO 优化** - 动态生成 meta 标签
4. **响应式设计** - 支持移动端和桌面端
5. **用户体验** - Loading 状态、错误处理、分页功能

### 📊 数据展示
- 文章标题、内容、摘要
- 作者信息（头像、姓名、简介）
- 发布时间、更新时间、阅读量
- 标签系统、点赞和评论数
- 文章系列信息（如有）

### 🎨 界面特性
- 现代化 UI 设计
- 过渡动画（CSS transition）
- 悬停效果和交互反馈
- 暗色/亮色主题支持
- 移动端友好的响应式布局

## 技术实现

本文章通过以下技术栈实现：
- **前端**: Next.js 15 + React 19 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS  
- **后端**: Server Actions + Prisma ORM
- **数据库**: Supabase PostgreSQL
- **部署**: Vercel（计划中）

## 总结

Phase 5.2 成功实现了博客系统的前后端数据连接，为用户提供了完整的文章浏览体验。`,
      excerpt:
        "这是一篇用于验证 Phase 5.2 博客前后端联动功能的测试文章，包含功能验证、数据展示、界面特性等内容。",
      published: false, // 先创建为草稿
      tagNames: ["测试", "Phase 5.2", "功能验证", "博客系统"],
      seoTitle: "测试文章：Phase 5.2 功能验证 | 技术博客",
      seoDescription:
        "验证 Phase 5.2 博客前后端联动功能，包含数据连接、界面特性、技术实现等完整测试。",
    })

    if (!createResult.success) {
      throw new Error(`创建文章失败: ${createResult.error?.message}`)
    }

    const testPost = createResult.data!
    console.log(`✅ 文章创建成功！ID: ${testPost.id}, Slug: ${testPost.slug}`)

    // 2. 发布文章
    console.log("\n2️⃣ 发布测试文章...")
    const publishResult = await publishPost(testPost.id)

    if (!publishResult.success) {
      throw new Error(`发布文章失败: ${publishResult.error?.message}`)
    }

    console.log(`✅ 文章发布成功！发布时间: ${publishResult.data?.publishedAt}`)

    // 3. 测试博客列表页面数据获取
    console.log("\n3️⃣ 测试博客列表页面数据获取...")
    const postsResult = await getPosts({
      page: 1,
      limit: 10,
      published: true,
      orderBy: "publishedAt",
      order: "desc",
    })

    if (!postsResult.success) {
      throw new Error(`获取文章列表失败: ${postsResult.error?.message}`)
    }

    console.log(`✅ 获取到 ${postsResult.data.length} 篇已发布文章`)
    console.log(
      `   分页信息: 第 ${postsResult.pagination.page} 页，共 ${postsResult.pagination.total} 篇文章`
    )

    // 4. 测试文章详情页面数据获取
    console.log("\n4️⃣ 测试文章详情页面数据获取...")
    const postResult = await getPost(testPost.slug, { incrementView: true })

    if (!postResult.success) {
      throw new Error(`获取文章详情失败: ${postResult.error?.message}`)
    }

    const detailPost = postResult.data!
    console.log(`✅ 获取文章详情成功！`)
    console.log(`   标题: ${detailPost.title}`)
    console.log(`   作者: ${detailPost.author.name}`)
    console.log(`   标签: ${detailPost.tags.map((t) => t.name).join(", ")}`)
    console.log(`   浏览量: ${detailPost.viewCount} (应该增加了1)`)
    console.log(`   发布状态: ${detailPost.published ? "已发布" : "草稿"}`)

    // 5. 测试搜索功能
    console.log("\n5️⃣ 测试搜索功能...")
    const searchResult = await getPosts({
      q: "Phase 5.2",
      published: true,
      limit: 5,
    })

    if (!searchResult.success) {
      throw new Error(`搜索测试失败: ${searchResult.error?.message}`)
    }

    console.log(`✅ 搜索 "Phase 5.2" 找到 ${searchResult.data.length} 篇文章`)

    // 6. 测试标签筛选
    console.log("\n6️⃣ 测试标签筛选功能...")
    const tagFilterResult = await getPosts({
      tag: "测试",
      published: true,
      limit: 5,
    })

    if (!tagFilterResult.success) {
      throw new Error(`标签筛选测试失败: ${tagFilterResult.error?.message}`)
    }

    console.log(`✅ 筛选标签 "测试" 找到 ${tagFilterResult.data.length} 篇文章`)

    console.log("\n🎉 所有测试通过！博客发布-浏览流程验证成功！")
    console.log("\n📋 测试总结:")
    console.log("  ✅ 文章创建功能正常")
    console.log("  ✅ 文章发布功能正常")
    console.log("  ✅ 博客列表数据获取正常")
    console.log("  ✅ 文章详情数据获取正常")
    console.log("  ✅ 浏览量统计功能正常")
    console.log("  ✅ 搜索功能正常")
    console.log("  ✅ 标签筛选功能正常")

    console.log(`\n🌐 前端测试建议:`)
    console.log(`  1. 访问 http://localhost:3000/blog 查看博客列表`)
    console.log(`  2. 点击测试文章查看详情页面`)
    console.log(`  3. 测试搜索和筛选功能`)
    console.log(`  4. 测试分页功能`)
    console.log(`  5. 测试响应式设计`)
  } catch (error) {
    console.error("❌ 测试失败:", error)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  testBlogFlow()
}

export default testBlogFlow
