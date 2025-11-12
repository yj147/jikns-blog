import { test, expect } from "@playwright/test"

test.describe("Admin PostList 错误态验证", () => {
  test.beforeEach(async ({ page }) => {
    await page.request.post("/api/dev/admin-posts/toggle-error", {
      data: { enabled: false },
    })
  })

  test("默认应加载文章列表", async ({ page }) => {
    await page.goto("/dev/admin/post-list")
    await expect(page.getByText("文章管理")).toBeVisible()
    await expect(page.getByRole("button", { name: "新建文章" })).toBeVisible()
  })

  test("当 server action 失败时展示错误并支持重试", async ({ page }) => {
    await page.request.post("/api/dev/admin-posts/toggle-error", {
      data: { enabled: true },
    })

    await page.goto("/dev/admin/post-list")
    await expect(page.getByText("文章列表加载失败")).toBeVisible()

    await page.request.post("/api/dev/admin-posts/toggle-error", {
      data: { enabled: false },
    })

    await page.getByRole("button", { name: "重试加载" }).click()
    await expect(page.getByText("文章管理")).toBeVisible()
  })
})
