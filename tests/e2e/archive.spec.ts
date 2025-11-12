import { expect, test } from "@playwright/test"
import { ensureArchiveSearchFixture } from "./utils/archive-fixtures"

test.beforeAll(async () => {
  await ensureArchiveSearchFixture()
})

test.describe("归档页面", () => {
  test("显示归档标题和时间线入口", async ({ page }) => {
    await page.goto("/archive", { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: "文章归档" })).toBeVisible()
    await expect(page.getByText("探索所有历史文章，按时间顺序浏览")).toBeVisible()
  })

  test("执行归档搜索并显示结果", async ({ page }) => {
    await page.goto("/archive", { waitUntil: "domcontentloaded" })

    const searchInput = page.getByLabel("搜索文章")
    await searchInput.fill("Playwright")
    const searchResponse = page.waitForResponse((response) => {
      return response.url().includes("/api/archive/search") && response.status() === 200
    })
    await page.getByRole("button", { name: "搜索" }).click()
    await searchResponse

    await expect(page.getByText("共找到 1 篇文章")).toBeVisible()
    await expect(page.getByRole("link", { name: "Playwright 归档测试" })).toBeVisible()
    await expect(page.getByText("关于 Playwright 的端到端测试记录")).toBeVisible()
  })

  test("在移动端视口下展示响应式布局", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("/archive", { waitUntil: "domcontentloaded" })

    await expect(page.getByRole("heading", { name: "文章归档" })).toBeVisible()
    await expect(page.getByRole("navigation", { name: "年份导航" })).toBeVisible()
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "auto" }))
    await page.waitForTimeout(100)
    await expect(page.getByRole("button", { name: "返回顶部" })).toHaveCount(0)
  })

  test("性能指标满足预期阈值", async ({ page }, testInfo) => {
    await page.goto("/archive", { waitUntil: "networkidle" })

    const metrics = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[]
      const resources = performance.getEntriesByType("resource")
      const memory = (performance as any).memory

      return {
        domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
        loadEventEnd: nav?.loadEventEnd ?? 0,
        resourceCount: resources.length,
        jsHeapUsed: memory?.usedJSHeapSize ?? null,
      }
    })

    await testInfo.attach("archive-performance-metrics.json", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    })

    console.log("[archive-metrics]", JSON.stringify(metrics))

    const domThreshold = process.env.CI ? 4000 : 7000
    const loadThreshold = process.env.CI ? 5000 : 9000

    expect(metrics.domContentLoaded).toBeLessThan(domThreshold)
    expect(metrics.loadEventEnd).toBeLessThan(loadThreshold)
    expect(metrics.resourceCount).toBeLessThanOrEqual(25)
  })
})
