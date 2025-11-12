/**
 * 点赞和收藏功能的 E2E 测试
 * 测试文章详情页的交互功能和个人收藏页
 */

import { test, expect, Page } from "@playwright/test"

// 测试账号配置
const TEST_USER = {
  email: "test@example.com",
  password: "TestPassword123!",
}

// 辅助函数：登录
async function login(page: Page) {
  await page.goto("/login/email")
  await page.fill("input#email", TEST_USER.email)
  await page.fill("input#password", TEST_USER.password)
  await page.click('button[type="submit"]')

  // 等待登录成功并跳转
  await page.waitForURL("/", { timeout: 10000 })
}

// 辅助函数：创建测试文章
async function createTestPost(page: Page) {
  // 导航到管理员创建文章页面
  await page.goto("/admin/blog/create")

  // 填写文章信息
  const postTitle = `测试文章 ${Date.now()}`
  await page.fill('[name="title"]', postTitle)
  await page.fill('[name="content"]', "这是一篇用于测试点赞和收藏功能的文章内容。")
  await page.fill('[name="slug"]', `test-post-${Date.now()}`)

  // 发布文章
  await page.click('button:has-text("发布")')

  // 等待成功提示
  await page.waitForSelector("text=文章发布成功", { timeout: 5000 })

  return postTitle
}

test.describe("点赞和收藏交互 E2E 测试", () => {
  test.beforeEach(async ({ page }) => {
    // 每个测试前先登录
    await login(page)
  })

  test("文章详情页点赞功能", async ({ page }) => {
    // 导航到博客列表
    await page.goto("/blog")

    // 点击第一篇文章进入详情页
    const firstPost = await page.locator("article").first()
    await firstPost.click()

    // 等待文章详情页加载
    await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

    // 获取初始点赞数
    const likeButton = page.locator('[data-testid="like-button"]')
    const initialLikeCount = await likeButton.locator('[data-testid="like-count"]').textContent()
    const initialCount = parseInt(initialLikeCount || "0")

    // 点击点赞按钮
    await likeButton.click()

    // 等待点赞成功（按钮状态变化）
    await expect(likeButton).toHaveAttribute("data-liked", "true", { timeout: 3000 })

    // 验证点赞数增加
    const newLikeCount = await likeButton.locator('[data-testid="like-count"]').textContent()
    const newCount = parseInt(newLikeCount || "0")
    expect(newCount).toBe(initialCount + 1)

    // 再次点击取消点赞
    await likeButton.click()

    // 等待取消点赞成功
    await expect(likeButton).toHaveAttribute("data-liked", "false", { timeout: 3000 })

    // 验证点赞数恢复
    const finalLikeCount = await likeButton.locator('[data-testid="like-count"]').textContent()
    const finalCount = parseInt(finalLikeCount || "0")
    expect(finalCount).toBe(initialCount)
  })

  test("文章详情页收藏功能", async ({ page }) => {
    // 导航到博客列表
    await page.goto("/blog")

    // 点击第一篇文章进入详情页
    const firstPost = await page.locator("article").first()
    const postTitle = await firstPost.locator("h2").textContent()
    await firstPost.click()

    // 等待文章详情页加载
    await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

    // 获取收藏按钮
    const bookmarkButton = page.locator('[data-testid="bookmark-button"]')

    // 点击收藏按钮
    await bookmarkButton.click()

    // 等待收藏成功（按钮状态变化）
    await expect(bookmarkButton).toHaveAttribute("data-bookmarked", "true", { timeout: 3000 })

    // 导航到个人收藏页
    await page.goto("/profile/bookmarks")

    // 验证收藏的文章出现在列表中
    await expect(page.locator(`text=${postTitle}`)).toBeVisible({ timeout: 5000 })

    // 返回文章详情页
    await page.goBack()

    // 再次点击取消收藏
    await bookmarkButton.click()

    // 等待取消收藏成功
    await expect(bookmarkButton).toHaveAttribute("data-bookmarked", "false", { timeout: 3000 })

    // 再次导航到个人收藏页验证文章已移除
    await page.goto("/profile/bookmarks")
    await expect(page.locator(`text=${postTitle}`)).not.toBeVisible()
  })

  test("点赞和收藏状态在刷新后保持", async ({ page }) => {
    // 导航到博客列表
    await page.goto("/blog")

    // 点击第一篇文章进入详情页
    const firstPost = await page.locator("article").first()
    await firstPost.click()

    // 等待文章详情页加载
    await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

    // 点赞和收藏文章
    const likeButton = page.locator('[data-testid="like-button"]')
    const bookmarkButton = page.locator('[data-testid="bookmark-button"]')

    await likeButton.click()
    await bookmarkButton.click()

    // 等待操作完成
    await expect(likeButton).toHaveAttribute("data-liked", "true", { timeout: 3000 })
    await expect(bookmarkButton).toHaveAttribute("data-bookmarked", "true", { timeout: 3000 })

    // 刷新页面
    await page.reload()

    // 等待页面重新加载
    await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

    // 验证状态保持
    await expect(likeButton).toHaveAttribute("data-liked", "true")
    await expect(bookmarkButton).toHaveAttribute("data-bookmarked", "true")

    // 清理：取消点赞和收藏
    await likeButton.click()
    await bookmarkButton.click()

    await expect(likeButton).toHaveAttribute("data-liked", "false", { timeout: 3000 })
    await expect(bookmarkButton).toHaveAttribute("data-bookmarked", "false", { timeout: 3000 })
  })

  test("个人收藏页分页功能", async ({ page }) => {
    // 首先收藏多篇文章（模拟有多页数据的情况）
    await page.goto("/blog")

    // 收藏前3篇文章
    const posts = await page.locator("article").all()
    const postsToBookmark = posts.slice(0, 3)

    for (const post of postsToBookmark) {
      await post.click()
      await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

      const bookmarkButton = page.locator('[data-testid="bookmark-button"]')
      const isBookmarked = await bookmarkButton.getAttribute("data-bookmarked")

      if (isBookmarked !== "true") {
        await bookmarkButton.click()
        await expect(bookmarkButton).toHaveAttribute("data-bookmarked", "true", { timeout: 3000 })
      }

      await page.goBack()
      await page.waitForSelector("article", { timeout: 5000 })
    }

    // 导航到个人收藏页
    await page.goto("/profile/bookmarks")

    // 验证至少有收藏的文章
    const bookmarkedItems = page.locator('[data-testid="bookmark-item"]')
    await expect(bookmarkedItems).toHaveCount(3, { timeout: 5000 })

    // 如果有分页，测试分页功能
    const pagination = page.locator('[data-testid="pagination"]')
    const hasPagination = await pagination.isVisible().catch(() => false)

    if (hasPagination) {
      // 点击下一页
      const nextButton = page.locator('[data-testid="pagination-next"]')
      if (await nextButton.isEnabled()) {
        await nextButton.click()

        // 等待新页面加载
        await page.waitForTimeout(1000)

        // 验证有新的内容加载
        await expect(bookmarkedItems.first()).toBeVisible()

        // 返回第一页
        const prevButton = page.locator('[data-testid="pagination-prev"]')
        await prevButton.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test("取消收藏功能", async ({ page }) => {
    // 先收藏一篇文章
    await page.goto("/blog")
    const firstPost = await page.locator("article").first()
    const postTitle = await firstPost.locator("h2").textContent()

    await firstPost.click()
    await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

    const bookmarkButton = page.locator('[data-testid="bookmark-button"]')
    await bookmarkButton.click()
    await expect(bookmarkButton).toHaveAttribute("data-bookmarked", "true", { timeout: 3000 })

    // 导航到个人收藏页
    await page.goto("/profile/bookmarks")

    // 找到收藏的文章
    const bookmarkItem = page.locator(`[data-testid="bookmark-item"]:has-text("${postTitle}")`)
    await expect(bookmarkItem).toBeVisible({ timeout: 5000 })

    // 点击取消收藏按钮
    const removeButton = bookmarkItem.locator('[data-testid="remove-bookmark"]')
    await removeButton.click()

    // 确认取消收藏对话框（如果有）
    const confirmDialog = page.locator('[role="dialog"]')
    if (await confirmDialog.isVisible().catch(() => false)) {
      await page.locator('button:has-text("确认")').click()
    }

    // 验证文章从收藏列表中移除
    await expect(bookmarkItem).not.toBeVisible({ timeout: 3000 })

    // 验证空状态提示（如果没有其他收藏）
    const bookmarkCount = await page.locator('[data-testid="bookmark-item"]').count()
    if (bookmarkCount === 0) {
      await expect(page.locator("text=暂无收藏内容")).toBeVisible()
    }
  })
})

test.describe("未登录用户交互限制", () => {
  test("未登录用户无法点赞", async ({ page }) => {
    // 不登录直接访问文章详情页
    await page.goto("/blog")
    const firstPost = await page.locator("article").first()
    await firstPost.click()

    await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

    // 尝试点击点赞按钮
    const likeButton = page.locator('[data-testid="like-button"]')
    await likeButton.click()

    // 应该弹出登录提示或跳转到登录页
    const loginPrompt = page.locator("text=请先登录")
    const isLoginPromptVisible = await loginPrompt.isVisible().catch(() => false)

    if (isLoginPromptVisible) {
      expect(isLoginPromptVisible).toBe(true)
    } else {
      // 或者被重定向到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 3000 })
    }
  })

  test("未登录用户无法收藏", async ({ page }) => {
    // 不登录直接访问文章详情页
    await page.goto("/blog")
    const firstPost = await page.locator("article").first()
    await firstPost.click()

    await page.waitForSelector('[data-testid="post-content"]', { timeout: 5000 })

    // 尝试点击收藏按钮
    const bookmarkButton = page.locator('[data-testid="bookmark-button"]')
    await bookmarkButton.click()

    // 应该弹出登录提示或跳转到登录页
    const loginPrompt = page.locator("text=请先登录")
    const isLoginPromptVisible = await loginPrompt.isVisible().catch(() => false)

    if (isLoginPromptVisible) {
      expect(isLoginPromptVisible).toBe(true)
    } else {
      // 或者被重定向到登录页
      await expect(page).toHaveURL(/\/login/, { timeout: 3000 })
    }
  })
})
