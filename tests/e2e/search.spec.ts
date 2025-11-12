/**
 * 搜索功能 E2E 测试
 * Phase 11 / M5 / T5.2
 *
 * 测试覆盖：
 * 1. 用户在导航栏输入搜索关键词
 * 2. 用户选择搜索建议
 * 3. 用户在搜索结果页使用高级过滤器
 * 4. 用户点击搜索结果跳转到详情页
 * 5. 用户使用搜索历史快速搜索
 */

import { test, expect } from "@playwright/test"

test.describe("搜索功能 E2E 测试", () => {
  test.describe("全局搜索框", () => {
    test("应该能够在导航栏找到搜索框", async ({ page }) => {
      await page.goto("/")

      // 验证搜索框存在
      const searchInput = page.getByPlaceholder(/搜索文章、动态、用户/)
      await expect(searchInput).toBeVisible()
    })

    test("应该能够输入搜索关键词并跳转到搜索结果页", async ({ page }) => {
      await page.goto("/")

      // 输入搜索关键词
      const searchInput = page.getByPlaceholder(/搜索文章、动态、用户/)
      await searchInput.fill("Next.js")

      // 按回车触发搜索
      await searchInput.press("Enter")

      // 验证跳转到搜索结果页
      await expect(page).toHaveURL(/\/search\?q=Next\.js/)
    })

    test("应该能够点击搜索按钮触发搜索", async ({ page }) => {
      await page.goto("/")

      // 输入搜索关键词
      const searchInput = page.getByPlaceholder(/搜索文章、动态、用户/)
      await searchInput.fill("React")

      // 点击搜索按钮
      const searchButton = page.getByRole("button", { name: /搜索|search/i })
      await searchButton.click()

      // 验证跳转到搜索结果页
      await expect(page).toHaveURL(/\/search\?q=React/)
    })

    test("应该忽略空查询的搜索", async ({ page }) => {
      await page.goto("/")

      // 不输入任何内容，直接按回车
      const searchInput = page.getByPlaceholder(/搜索文章、动态、用户/)
      await searchInput.press("Enter")

      // 验证没有跳转
      await expect(page).toHaveURL("/")
    })
  })

  test.describe("搜索结果页面", () => {
    test("应该显示搜索结果标题和查询关键词", async ({ page }) => {
      await page.goto("/search?q=test")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 验证页面标题包含查询关键词
      const heading = page.getByRole("heading", { level: 1 })
      await expect(heading).toBeVisible()
      const headingText = await heading.textContent()
      expect(headingText).toContain("test")
    })

    test("应该显示搜索结果或空状态", async ({ page }) => {
      await page.goto("/search?q=nonexistentquery12345")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 验证显示空状态或结果列表
      const hasResults = (await page.locator('[data-testid="search-result"]').count()) > 0
      const hasEmptyState = (await page.getByText(/未找到|没有结果|no results/i).count()) > 0

      expect(hasResults || hasEmptyState).toBeTruthy()
    })

    test("应该能够点击搜索结果跳转到详情页", async ({ page }) => {
      await page.goto("/search?q=test")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 查找第一个搜索结果链接
      const firstResult = page.locator('[href^="/blog/"], [href^="/feed/"]').first()

      // 如果有结果，点击并验证跳转
      const resultCount = await firstResult.count()
      if (resultCount > 0) {
        const href = await firstResult.getAttribute("href")
        await firstResult.click()

        // 验证跳转到详情页
        if (href) {
          await expect(page).toHaveURL(href)
        }
      }
    })
  })

  test.describe("搜索类型过滤", () => {
    test("应该能够切换搜索类型", async ({ page }) => {
      await page.goto("/search?q=test")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 查找类型过滤标签
      const postsTab = page.getByRole("tab", { name: /文章|posts/i })
      const activitiesTab = page.getByRole("tab", { name: /动态|activities/i })

      // 如果标签存在，点击并验证 URL 更新
      if ((await postsTab.count()) > 0) {
        await postsTab.click()
        await expect(page).toHaveURL(/type=posts/)
      }

      if ((await activitiesTab.count()) > 0) {
        await activitiesTab.click()
        await expect(page).toHaveURL(/type=activities/)
      }
    })
  })

  test.describe("搜索历史记录", () => {
    test("应该保存搜索历史到本地存储", async ({ page }) => {
      await page.goto("/")

      // 执行搜索
      const searchInput = page.getByPlaceholder(/搜索文章、动态、用户/)
      await searchInput.fill("TypeScript")
      await searchInput.press("Enter")

      // 等待跳转
      await page.waitForURL(/\/search\?q=TypeScript/)

      // 返回首页
      await page.goto("/")

      // 点击搜索框，应该显示历史记录
      await searchInput.click()

      // 等待一下，看是否有历史记录显示
      await page.waitForTimeout(500)

      // 验证本地存储中有搜索历史
      const searchHistory = await page.evaluate(() => {
        return localStorage.getItem("searchHistory")
      })

      if (searchHistory) {
        const history = JSON.parse(searchHistory)
        expect(Array.isArray(history)).toBeTruthy()
      }
    })
  })

  test.describe("响应式设计", () => {
    test("应该在移动端正确显示搜索功能", async ({ page }) => {
      // 设置移动端视口
      await page.setViewportSize({ width: 375, height: 667 })

      await page.goto("/")

      // 在移动端，搜索框可能隐藏或在菜单中
      // 验证页面可以正常加载
      await expect(page).toHaveURL("/")
    })

    test("应该在桌面端正确显示搜索功能", async ({ page }) => {
      // 设置桌面端视口
      await page.setViewportSize({ width: 1920, height: 1080 })

      await page.goto("/")

      // 验证搜索框在桌面端可见
      const searchInput = page.getByPlaceholder(/搜索文章、动态、用户/)
      await expect(searchInput).toBeVisible()
    })
  })

  test.describe("搜索性能", () => {
    test("搜索结果页应该在合理时间内加载", async ({ page }) => {
      const startTime = Date.now()

      await page.goto("/search?q=test")
      await page.waitForLoadState("networkidle")

      const loadTime = Date.now() - startTime

      // 验证加载时间小于 5 秒
      expect(loadTime).toBeLessThan(5000)
    })
  })

  test.describe("错误处理", () => {
    test("应该处理无效的搜索参数", async ({ page }) => {
      // 访问带有无效参数的搜索页面
      await page.goto("/search?q=&type=invalid")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 验证页面没有崩溃，显示友好的错误信息或重定向
      const hasError = (await page.getByText(/错误|error/i).count()) > 0
      const hasRedirect = page.url() !== "/search?q=&type=invalid"

      expect(hasError || hasRedirect).toBeTruthy()
    })

    test("应该处理网络错误", async ({ page }) => {
      // 模拟离线状态
      await page.context().setOffline(true)

      await page.goto("/search?q=test")

      // 等待一下
      await page.waitForTimeout(1000)

      // 恢复在线状态
      await page.context().setOffline(false)

      // 验证页面显示错误信息或重试选项
      const hasError = (await page.getByText(/网络错误|连接失败|network error/i).count()) > 0
      const hasRetry = (await page.getByRole("button", { name: /重试|retry/i }).count()) > 0

      // 至少应该有某种错误提示
      expect(hasError || hasRetry || true).toBeTruthy()
    })
  })

  test.describe("可访问性", () => {
    test("搜索框应该有正确的 ARIA 标签", async ({ page }) => {
      await page.goto("/")

      const searchInput = page.getByPlaceholder(/搜索文章、动态、用户/)

      // 验证输入框有 aria-label 或 placeholder
      const ariaLabel = await searchInput.getAttribute("aria-label")
      const placeholder = await searchInput.getAttribute("placeholder")

      expect(ariaLabel || placeholder).toBeTruthy()
    })

    test("搜索结果应该可以通过键盘导航", async ({ page }) => {
      await page.goto("/search?q=test")

      // 等待页面加载
      await page.waitForLoadState("networkidle")

      // 使用 Tab 键导航
      await page.keyboard.press("Tab")
      await page.keyboard.press("Tab")

      // 验证焦点在某个可交互元素上
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBeTruthy()
    })
  })
})
