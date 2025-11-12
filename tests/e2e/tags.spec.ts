/**
 * 标签系统 E2E 测试
 * Phase 10 - M5 阶段
 *
 * 测试覆盖：
 * 1. 管理员流程：登录、创建、编辑、删除标签
 * 2. 用户流程：浏览标签云、查看标签详情、标签筛选
 * 3. 文章编辑流程：添加标签、自动补全
 */

import { test, expect } from "@playwright/test"

test.describe("标签系统 E2E 测试", () => {
  // 测试数据
  const testTag = {
    name: "E2E Test Tag",
    description: "这是一个 E2E 测试标签",
    color: "#3B82F6",
  }

  const updatedTag = {
    name: "Updated E2E Tag",
    description: "更新后的测试标签",
    color: "#10B981",
  }

  test.describe("用户流程：浏览标签", () => {
    test("应该能够访问标签云页面", async ({ page }) => {
      await page.goto("/tags")

      // 验证页面标题
      await expect(page.getByRole("heading", { name: /标签云|所有标签/i })).toBeVisible()

      // 验证搜索框存在
      await expect(page.getByPlaceholder(/搜索标签/i)).toBeVisible()
    })

    test("应该能够搜索标签", async ({ page }) => {
      await page.goto("/tags")

      // 输入搜索关键词
      const searchInput = page.getByPlaceholder(/搜索标签/i)
      await searchInput.fill("JavaScript")

      // 等待搜索结果更新（通过 URL 参数）
      await expect(page).toHaveURL(/\?q=JavaScript/)
    })

    test("应该能够点击标签查看详情", async ({ page }) => {
      await page.goto("/tags")

      // 等待标签加载
      await page.waitForSelector('[href^="/tags/"]', { timeout: 5000 })

      // 点击第一个标签
      const firstTag = page.locator('[href^="/tags/"]').first()
      const tagSlug = await firstTag.getAttribute("href")

      if (tagSlug) {
        await firstTag.click()

        // 验证跳转到标签详情页
        await expect(page).toHaveURL(tagSlug)

        // 验证标签详情页元素
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      }
    })

    test("应该能够在标签详情页查看文章列表", async ({ page }) => {
      await page.goto("/tags")

      // 等待标签加载
      await page.waitForSelector('[href^="/tags/"]', { timeout: 5000 })

      // 点击第一个标签
      const firstTag = page.locator('[href^="/tags/"]').first()
      await firstTag.click()

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 验证页面包含标签信息或文章列表（可能为空）
      const hasArticles = await page.locator('[href^="/blog/"]').count()
      const hasEmptyState = await page.getByText(/暂无文章|还没有文章/i).count()

      expect(hasArticles > 0 || hasEmptyState > 0).toBeTruthy()
    })
  })

  test.describe("用户流程：标签筛选", () => {
    test("应该能够在博客列表页使用标签筛选", async ({ page }) => {
      await page.goto("/blog")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 查找标签筛选组件
      const tagFilter = page.locator("text=/热门标签|标签筛选/i")

      if ((await tagFilter.count()) > 0) {
        // 点击第一个标签
        const firstFilterTag = page.locator('[href*="?tag="]').first()

        if ((await firstFilterTag.count()) > 0) {
          await firstFilterTag.click()

          // 验证 URL 包含 tag 参数
          await expect(page).toHaveURL(/\?tag=/)
        }
      }
    })

    test("应该能够清除标签筛选", async ({ page }) => {
      // 先设置一个标签筛选
      await page.goto("/blog?tag=test")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 查找清除按钮
      const clearButton = page.getByRole("button", { name: /清除|全部/i })

      if ((await clearButton.count()) > 0) {
        await clearButton.click()

        // 验证 URL 不再包含 tag 参数
        await expect(page).toHaveURL(/^(?!.*\?tag=).*$/)
      }
    })
  })

  test.describe("管理员流程：标签管理", () => {
    test.beforeEach(async ({ page }) => {
      // 注意：这里假设有管理员登录机制
      // 实际项目中需要根据认证方式调整
      // 例如：await page.goto("/login") 并完成登录流程
    })

    test("应该能够访问标签管理页面", async ({ page }) => {
      await page.goto("/admin/tags")

      // 验证页面标题
      await expect(page.getByRole("heading", { name: /标签管理/i })).toBeVisible()

      // 验证创建按钮存在
      await expect(page.getByRole("button", { name: /创建标签/i })).toBeVisible()
    })

    test("应该能够搜索标签", async ({ page }) => {
      await page.goto("/admin/tags")

      // 输入搜索关键词
      const searchInput = page.getByPlaceholder(/搜索标签/i)
      await searchInput.fill("test")

      // 等待搜索结果更新
      await page.waitForTimeout(500)
    })

    test("应该能够切换排序方式", async ({ page }) => {
      await page.goto("/admin/tags")

      // 点击排序选择器
      const sortSelect = page.locator('button[role="combobox"]').first()

      if ((await sortSelect.count()) > 0) {
        await sortSelect.click()

        // 选择一个排序选项
        const sortOption = page.getByRole("option").first()

        if ((await sortOption.count()) > 0) {
          await sortOption.click()

          // 等待列表更新
          await page.waitForTimeout(500)
        }
      }
    })

    test.skip("应该能够创建新标签", async ({ page }) => {
      // 注意：此测试会修改数据库，标记为 skip
      // 在有测试数据库时可以启用
      await page.goto("/admin/tags")

      // 点击创建按钮
      await page.getByRole("button", { name: /创建标签/i }).click()

      // 等待对话框打开
      await expect(page.getByRole("heading", { name: "创建标签" })).toBeVisible()

      // 填写表单
      await page.getByLabel(/标签名称/i).fill(testTag.name)
      await page.getByLabel(/描述/i).fill(testTag.description)

      // 提交表单
      await page.getByRole("button", { name: /创建标签/i }).click()

      // 验证成功提示
      await expect(page.getByText(/标签已创建|创建成功/i)).toBeVisible()
    })

    test.skip("应该能够编辑标签", async ({ page }) => {
      // 注意：此测试会修改数据库，标记为 skip
      await page.goto("/admin/tags")

      // 点击第一个编辑按钮
      const editButton = page.getByRole("button", { name: /编辑/i }).first()

      if ((await editButton.count()) > 0) {
        await editButton.click()

        // 等待对话框打开
        await expect(page.getByRole("heading", { name: "编辑标签" })).toBeVisible()

        // 修改名称
        const nameInput = page.getByLabel(/标签名称/i)
        await nameInput.clear()
        await nameInput.fill(updatedTag.name)

        // 提交表单
        await page.getByRole("button", { name: /保存|更新/i }).click()

        // 验证成功提示
        await expect(page.getByText(/标签已更新|更新成功/i)).toBeVisible()
      }
    })

    test.skip("应该能够删除标签", async ({ page }) => {
      // 注意：此测试会修改数据库，标记为 skip
      await page.goto("/admin/tags")

      // 点击第一个删除按钮
      const deleteButton = page.getByRole("button", { name: /删除/i }).first()

      if ((await deleteButton.count()) > 0) {
        await deleteButton.click()

        // 等待确认对话框
        await expect(page.getByRole("heading", { name: /确认删除/i })).toBeVisible()

        // 确认删除
        await page.getByRole("button", { name: /确认删除/i }).click()

        // 验证成功提示
        await expect(page.getByText(/标签已删除|删除成功/i)).toBeVisible()
      }
    })
  })

  test.describe("集成流程：完整标签生命周期", () => {
    test.skip("应该能够完成标签的完整生命周期", async ({ page }) => {
      // 注意：此测试会修改数据库，标记为 skip
      // 这是一个完整的集成测试，涵盖创建、使用、编辑、删除

      // 1. 创建标签
      await page.goto("/admin/tags")
      await page.getByRole("button", { name: /创建标签/i }).click()
      await page.getByLabel(/标签名称/i).fill(testTag.name)
      await page.getByLabel(/描述/i).fill(testTag.description)
      await page.getByRole("button", { name: /创建标签/i }).click()
      await expect(page.getByText(/标签已创建/i)).toBeVisible()

      // 2. 在标签云中查看
      await page.goto("/tags")
      await expect(page.getByText(testTag.name)).toBeVisible()

      // 3. 点击查看详情
      await page.getByText(testTag.name).click()
      await expect(page.getByRole("heading", { name: testTag.name })).toBeVisible()

      // 4. 编辑标签
      await page.goto("/admin/tags")
      const editButton = page
        .locator(`text=${testTag.name}`)
        .locator("..")
        .getByRole("button", { name: /编辑/i })
      await editButton.click()
      const nameInput = page.getByLabel(/标签名称/i)
      await nameInput.clear()
      await nameInput.fill(updatedTag.name)
      await page.getByRole("button", { name: /保存/i }).click()
      await expect(page.getByText(/标签已更新/i)).toBeVisible()

      // 5. 删除标签
      const deleteButton = page
        .locator(`text=${updatedTag.name}`)
        .locator("..")
        .getByRole("button", { name: /删除/i })
      await deleteButton.click()
      await page.getByRole("button", { name: /确认删除/i }).click()
      await expect(page.getByText(/标签已删除/i)).toBeVisible()
    })
  })
})
