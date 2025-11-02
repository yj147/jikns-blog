/**
 * Post CRUD Server Actions 测试脚本
 * 验证 Phase 5.1.2 实现的功能
 */

import { prisma } from "../lib/prisma"
import { createPost, getPosts, getPost, updatePost, deletePost } from "../lib/actions/posts"
import type { CreatePostRequest, UpdatePostRequest } from "../types/api"

async function testPostActions() {
  console.log("🧪 开始测试 Post CRUD Server Actions...")

  try {
    // 测试数据库连接
    console.log("\n1. 测试数据库连接...")
    await prisma.$connect()
    console.log("✅ 数据库连接成功")

    // 检查是否有管理员用户
    console.log("\n2. 检查管理员用户...")
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", status: "ACTIVE" },
    })

    if (!adminUser) {
      console.log("❌ 未找到可用的管理员用户，请先创建管理员账户")
      console.log("提示：可以通过注册账户后手动修改数据库 role 字段为 'ADMIN'")
      return
    }
    console.log(`✅ 找到管理员用户: ${adminUser.email} (${adminUser.id})`)

    // 测试创建文章
    console.log("\n3. 测试创建文章...")
    const createPostData: CreatePostRequest = {
      title: "测试文章 - Post CRUD 验证",
      content:
        "这是一篇用于验证 Post CRUD Server Actions 功能的测试文章。包含完整的 Markdown 内容，用于测试内容管理系统的各项功能。\n\n## 功能测试\n\n- 文章创建 ✅\n- 文章查询 🔄\n- 文章更新 ⏳\n- 文章删除 ⏳\n\n该测试确保所有核心功能正常运行。",
      excerpt: "这是一篇用于验证 Post CRUD Server Actions 功能的测试文章",
      published: false,
      tagNames: ["测试", "Server Actions", "CRUD"],
    }

    const createResult = await createPost(createPostData)
    if (!createResult.success) {
      console.log("❌ 创建文章失败:", createResult.error?.message)
      return
    }
    console.log("✅ 创建文章成功:", createResult.data?.slug)
    const testPostId = createResult.data?.id!

    // 测试获取文章列表
    console.log("\n4. 测试获取文章列表...")
    const postsResult = await getPosts({ limit: 5 })
    if (!postsResult.success) {
      console.log("❌ 获取文章列表失败:", postsResult.error?.message)
      return
    }
    console.log(`✅ 获取文章列表成功: ${postsResult.data.length} 篇文章`)
    console.log(
      `   分页信息: ${postsResult.pagination.page}/${postsResult.pagination.totalPages} (共 ${postsResult.pagination.total} 篇)`
    )

    // 测试获取单篇文章
    console.log("\n5. 测试获取单篇文章...")
    const postResult = await getPost(testPostId)
    if (!postResult.success) {
      console.log("❌ 获取文章失败:", postResult.error?.message)
      return
    }
    console.log(`✅ 获取文章成功: ${postResult.data?.title}`)
    console.log(`   标签: ${postResult.data?.tags.map((t) => t.name).join(", ")}`)

    // 测试更新文章
    console.log("\n6. 测试更新文章...")
    const updatePostData: UpdatePostRequest = {
      id: testPostId,
      title: "测试文章 - 已更新",
      content: postResult.data?.content + "\n\n## 更新测试\n\n文章内容已成功更新 ✅",
      published: true,
      tagNames: ["测试", "Server Actions", "CRUD", "更新"],
    }

    const updateResult = await updatePost(updatePostData)
    if (!updateResult.success) {
      console.log("❌ 更新文章失败:", updateResult.error?.message)
      return
    }
    console.log("✅ 更新文章成功:", updateResult.data?.title)
    console.log(`   发布状态: ${updateResult.data?.published ? "已发布" : "草稿"}`)

    // 测试搜索功能
    console.log("\n7. 测试搜索功能...")
    const searchResult = await getPosts({ q: "测试", published: true })
    if (!searchResult.success) {
      console.log("❌ 搜索文章失败:", searchResult.error?.message)
      return
    }
    console.log(`✅ 搜索文章成功: 找到 ${searchResult.data.length} 篇匹配文章`)

    // 测试删除文章
    console.log("\n8. 测试删除文章...")
    const deleteResult = await deletePost(testPostId)
    if (!deleteResult.success) {
      console.log("❌ 删除文章失败:", deleteResult.error?.message)
      return
    }
    console.log("✅ 删除文章成功")

    // 验证删除结果
    console.log("\n9. 验证删除结果...")
    const deletedPostResult = await getPost(testPostId)
    if (deletedPostResult.success) {
      console.log("❌ 文章删除验证失败: 文章仍然存在")
      return
    }
    console.log("✅ 删除验证成功: 文章已不存在")

    console.log("\n🎉 所有测试完成！Post CRUD Server Actions 功能正常")
  } catch (error) {
    console.error("\n❌ 测试过程中出现错误:", error)
  } finally {
    await prisma.$disconnect()
    console.log("\n📝 数据库连接已关闭")
  }
}

// 如果直接运行此文件则执行测试
if (require.main === module) {
  testPostActions().catch(console.error)
}

export { testPostActions }
