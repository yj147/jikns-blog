/**
 * 中间件收敛冒烟测试
 * 验证中间件 matcher 收敛后的行为
 * 确保公开页面不被阻断，受保护页面仍需认证
 */

import { test, expect } from "@playwright/test"

test.describe("中间件收敛验证", () => {
  test.describe("公开页面访问", () => {
    test("首页应该可以正常访问", async ({ page }) => {
      const response = await page.goto("/")
      expect(response?.status()).toBe(200)

      // 验证页面内容加载
      await expect(page.locator("h1")).toBeVisible()
    })

    test("博客列表页应该可以正常访问", async ({ page }) => {
      const response = await page.goto("/blog")
      expect(response?.status()).toBe(200)

      // 验证页面内容加载
      await expect(page.locator("main")).toBeVisible()
    })

    test("博客详情页应该可以正常访问", async ({ page }) => {
      // 先获取一个有效的文章slug
      await page.goto("/blog")
      const firstPost = page.locator("article").first()

      if ((await firstPost.count()) > 0) {
        const postLink = await firstPost.locator("a").first().getAttribute("href")
        if (postLink) {
          const response = await page.goto(postLink)
          expect(response?.status()).toBe(200)

          // 验证文章内容容器存在
          await expect(page.locator('[data-testid="post-content"]')).toBeVisible()
        }
      }
    })

    test("登录页应该可以正常访问", async ({ page }) => {
      const response = await page.goto("/login")
      expect(response?.status()).toBe(200)

      // 验证登录表单存在
      await expect(page.locator("form")).toBeVisible()
    })

    test("注册页应该可以正常访问", async ({ page }) => {
      const response = await page.goto("/register")
      expect(response?.status()).toBe(200)

      // 验证注册表单存在
      await expect(page.locator("form")).toBeVisible()
    })

    test("搜索页应该可以正常访问", async ({ page }) => {
      const response = await page.goto("/search")
      expect(response?.status()).toBe(200)

      // 验证搜索输入框存在
      await expect(page.locator('input[type="search"], input[placeholder*="搜索"]')).toBeVisible()
    })
  })

  test.describe("受保护页面访问控制", () => {
    test("未登录访问管理员页面应该被重定向", async ({ page }) => {
      await page.goto("/admin")

      // 应该被重定向到登录页或未授权页
      await expect(page).toHaveURL(/\/(login|unauthorized)/)
    })

    test("未登录访问个人资料页应该被重定向", async ({ page }) => {
      await page.goto("/profile")

      // 应该被重定向到登录页或未授权页
      await expect(page).toHaveURL(/\/(login|unauthorized)/)
    })

    test("未登录访问设置页应该被重定向", async ({ page }) => {
      await page.goto("/settings")

      // 应该被重定向到登录页或未授权页
      await expect(page).toHaveURL(/\/(login|unauthorized)/)
    })
  })

  test.describe("API 端点保护", () => {
    test("公开 API 应该可以访问", async ({ request }) => {
      // 获取博客列表（公开 API）
      const response = await request.get("/api/posts")
      expect(response.status()).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty("data")
    })

    test("受保护 API 未认证应该返回 401", async ({ request }) => {
      // 访问用户资料 API（需要认证）
      const response = await request.get("/api/user/profile")
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty("error")
    })

    test("管理员 API 未认证应该返回 401", async ({ request }) => {
      // 访问管理员 API
      const response = await request.get("/api/admin/users")
      expect(response.status()).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty("error")
    })

    test("认证相关 API 应该正常工作", async ({ request }) => {
      // 测试登录 API（虽然会失败，但应该返回合理的错误）
      const response = await request.post("/api/auth/login", {
        data: {
          email: "test@example.com",
          password: "wrongpassword",
        },
      })

      // 应该返回 401（认证失败）而不是 500（服务器错误）
      expect([400, 401]).toContain(response.status())
    })
  })

  test.describe("静态资源访问", () => {
    test("静态图片应该可以访问", async ({ request }) => {
      const response = await request.get("/placeholder.svg")
      expect(response.status()).toBe(200)
    })

    test("favicon 应该可以访问", async ({ request }) => {
      const response = await request.head("/favicon.ico")
      // favicon 可能不存在，但不应该被中间件阻断
      expect([200, 404]).toContain(response.status())
    })
  })

  test.describe("中间件性能验证", () => {
    test("公开页面响应时间应该合理", async ({ page }) => {
      const startTime = Date.now()
      await page.goto("/")
      const endTime = Date.now()

      // 响应时间应该小于 3 秒（宽松的限制）
      expect(endTime - startTime).toBeLessThan(3000)
    })

    test("多个并发请求应该正常处理", async ({ request }) => {
      const requests = [
        request.get("/api/posts"),
        request.get("/api/activities"),
        request.get("/api/posts?page=1"),
        request.get("/api/posts?page=2"),
        request.get("/api/activities?page=1"),
      ]

      const responses = await Promise.all(requests)

      // 所有请求都应该成功
      responses.forEach((response) => {
        expect(response.status()).toBe(200)
      })
    })
  })
})
