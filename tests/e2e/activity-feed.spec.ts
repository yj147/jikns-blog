import { test, expect } from "@playwright/test"

const METRICS_CONTENT = "夜间计划运行 30 次 Lighthouse"
const HERO_CONTENT = "Hero skeleton + streaming SSR 联调通过"
const MOBILE_CONTENT = "移动端夜间出现 FPS 抖动"
const SEARCH_TERM = "Lighthouse"

function waitForActivitiesResponse(page: Parameters<typeof test>[0]["page"], query: string) {
  return page.waitForResponse((response) => {
    if (!response.url().includes("/api/activities")) return false
    if (response.request().method() !== "GET") return false
    return response.url().includes(query)
  })
}

function activitySearchInput(page: Parameters<typeof test>[0]["page"]) {
  return page.getByRole("textbox", { name: "搜索动态" }).first()
}

test.describe("Activity feed (real data)", () => {
  test("renders seeded feed and filters by image content", async ({ page }) => {
    const initialResponse = waitForActivitiesResponse(page, "orderBy=latest")
    await page.goto("/activities")
    await initialResponse

    await expect(page.getByRole("heading", { name: "动态" })).toBeVisible()
    const metricsPost = page.getByText(METRICS_CONTENT)
    await expect(metricsPost).toBeVisible()

    const filterResponse = waitForActivitiesResponse(page, "hasImages=true")
    await page.getByRole("button", { name: "过滤" }).click()
    const dialog = page.getByRole("dialog", { name: "过滤动态" })
    await dialog.getByRole("combobox").first().click()
    await page.getByRole("option", { name: "包含图片" }).click()
    await filterResponse
    await page.keyboard.press("Escape")

    await expect(page.getByText(HERO_CONTENT)).toBeVisible()
    await expect(page.getByText(MOBILE_CONTENT)).toBeVisible()
    await expect(metricsPost).toHaveCount(0)
  })

  test("supports searching seeded activities", async ({ page }) => {
    const initialResponse = waitForActivitiesResponse(page, "orderBy=latest")
    await page.goto("/activities")
    await initialResponse

    const searchInput = activitySearchInput(page)
    await expect(searchInput).toBeVisible()
    await searchInput.fill(SEARCH_TERM)
    const searchResponse = waitForActivitiesResponse(page, `q=${encodeURIComponent(SEARCH_TERM)}`)
    await page.getByRole("button", { name: "应用搜索" }).click()
    await searchResponse

    await expect(page.getByText("没有找到匹配的动态")).toBeVisible()
    await expect(page.getByText(/当前搜索/)).toContainText(SEARCH_TERM)
  })
})
