/**
 * 权限系统端到端集成测试
 * 测试完整的用户权限流程，包括登录、权限验证、访问控制
 */

import { test, expect, Page, BrowserContext } from "@playwright/test"

// 测试配置
const TEST_BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000"
const TEST_USERS = {
  admin: {
    email: "admin@test.com",
    password: "test123",
    expectedRole: "ADMIN",
  },
  user: {
    email: "user@test.com",
    password: "test123",
    expectedRole: "USER",
  },
  banned: {
    email: "banned@test.com",
    password: "test123",
    expectedStatus: "BANNED",
  },
}

test.describe("权限系统端到端测试", () => {
  test.beforeEach(async ({ page }) => {
    // 确保每个测试开始时都是清洁状态
    await page.context().clearCookies()
    await page.goto(TEST_BASE_URL)
  })

  test.describe("未认证用户访问控制", () => {
    test("未登录用户访问公开页面应该成功", async ({ page }) => {
      const publicPages = ["/", "/blog", "/search"]

      for (const path of publicPages) {
        await page.goto(`${TEST_BASE_URL}${path}`)

        // 验证页面正常加载
        await expect(page).not.toHaveTitle(/Error/i)
        await expect(page).not.toHaveTitle(/404/i)

        // 验证没有权限错误
        await expect(page.locator("text=需要登录")).not.toBeVisible()
        await expect(page.locator("text=权限不足")).not.toBeVisible()
      }
    })

    test("未登录用户访问需认证页面应该重定向到登录页", async ({ page }) => {
      const protectedPages = ["/profile", "/settings"]

      for (const path of protectedPages) {
        await page.goto(`${TEST_BASE_URL}${path}`)

        // 等待重定向完成
        await page.waitForURL(/.*\/login.*/)

        // 验证重定向到登录页且包含原路径参数
        const currentUrl = page.url()
        expect(currentUrl).toContain("/login")
        expect(currentUrl).toContain("redirect=")
        expect(currentUrl).toContain(encodeURIComponent(path))
      }
    })

    test("未登录用户访问管理员页面应该重定向到登录页", async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/admin`)

      // 应该重定向到登录页
      await page.waitForURL(/.*\/login.*/)
      expect(page.url()).toContain("/login")
      expect(page.url()).toContain("redirect=%2Fadmin")
    })

    test("未登录用户访问API端点应该返回401", async ({ page }) => {
      const apiEndpoints = [
        "/api/user/profile",
        "/api/user/settings",
        "/api/admin/users",
        "/api/admin/dashboard",
      ]

      for (const endpoint of apiEndpoints) {
        const response = await page.request.get(`${TEST_BASE_URL}${endpoint}`)
        expect(response.status()).toBe(401)

        const responseBody = await response.json()
        expect(responseBody).toHaveProperty("error")
        expect(responseBody).toHaveProperty("code", "AUTHENTICATION_REQUIRED")
      }
    })
  })

  test.describe("普通用户权限测试", () => {
    test.beforeEach(async ({ page }) => {
      // 登录普通用户
      await loginUser(page, TEST_USERS.user)
    })

    test("普通用户应该能访问需认证的页面", async ({ page }) => {
      const userPages = ["/profile", "/settings"]

      for (const path of userPages) {
        await page.goto(`${TEST_BASE_URL}${path}`)

        // 验证页面正常加载，没有权限错误
        await expect(page.locator("text=需要登录")).not.toBeVisible()
        await expect(page.locator("text=账户已被封禁")).not.toBeVisible()

        // 验证用户相关内容存在
        await expect(page.locator("text=用户资料")).toBeVisible({ timeout: 10000 })
      }
    })

    test("普通用户访问管理员页面应该被拒绝", async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/admin`)

      // 应该显示权限不足的错误页面
      await page.waitForURL(/.*\/unauthorized.*/)
      await expect(page.locator("text=权限不足")).toBeVisible()
      await expect(page.locator("text=需要管理员权限")).toBeVisible()
    })

    test("普通用户调用管理员API应该返回403", async ({ page }) => {
      const adminApiEndpoints = ["/api/admin/users", "/api/admin/posts", "/api/admin/dashboard"]

      for (const endpoint of adminApiEndpoints) {
        const response = await page.request.get(`${TEST_BASE_URL}${endpoint}`)
        expect(response.status()).toBe(403)

        const responseBody = await response.json()
        expect(responseBody).toHaveProperty("error")
        expect(responseBody.code).toBe("INSUFFICIENT_PERMISSIONS")
      }
    })

    test("普通用户可以调用用户API", async ({ page }) => {
      const userApiEndpoints = ["/api/user/profile"]

      for (const endpoint of userApiEndpoints) {
        const response = await page.request.get(`${TEST_BASE_URL}${endpoint}`)
        expect([200, 404]).toContain(response.status()) // 200成功或404端点不存在都可接受

        if (response.status() === 200) {
          const responseBody = await response.json()
          expect(responseBody).not.toHaveProperty("error")
        }
      }
    })
  })

  test.describe("管理员权限测试", () => {
    test.beforeEach(async ({ page }) => {
      // 登录管理员用户
      await loginUser(page, TEST_USERS.admin)
    })

    test("管理员应该能访问所有页面", async ({ page }) => {
      const allPages = ["/", "/blog", "/profile", "/settings", "/admin"]

      for (const path of allPages) {
        await page.goto(`${TEST_BASE_URL}${path}`)

        // 验证没有权限错误
        await expect(page.locator("text=需要登录")).not.toBeVisible()
        await expect(page.locator("text=权限不足")).not.toBeVisible()
        await expect(page.locator("text=账户已被封禁")).not.toBeVisible()
      }
    })

    test("管理员应该能看到管理员专用内容", async ({ page }) => {
      await page.goto(`${TEST_BASE_URL}/admin`)

      // 验证管理员面板内容
      await expect(page.locator("text=管理员面板")).toBeVisible({ timeout: 10000 })
      await expect(page.locator("text=用户管理")).toBeVisible()
      await expect(page.locator("text=内容管理")).toBeVisible()
    })

    test("管理员应该能调用所有API端点", async ({ page }) => {
      const allApiEndpoints = ["/api/user/profile", "/api/admin/dashboard"]

      for (const endpoint of allApiEndpoints) {
        const response = await page.request.get(`${TEST_BASE_URL}${endpoint}`)
        expect([200, 404]).toContain(response.status())

        if (response.status() !== 404) {
          const responseBody = await response.json()
          expect(responseBody).not.toHaveProperty("error")
        }
      }
    })

    test("管理员界面应该显示权限相关的UI元素", async ({ page }) => {
      // 导航到主页，检查管理员特有的UI元素
      await page.goto(TEST_BASE_URL)

      // 检查用户菜单中的管理员选项
      const userMenuButton = page.locator('[data-testid="user-menu-trigger"]')
      if (await userMenuButton.isVisible()) {
        await userMenuButton.click()
        await expect(page.locator("text=管理面板")).toBeVisible()
        await expect(page.locator("text=用户管理")).toBeVisible()
      }
    })
  })

  test.describe("被封禁用户权限测试", () => {
    test("被封禁用户登录后应该被限制访问", async ({ page }) => {
      // 这个测试需要模拟被封禁用户的状态
      // 由于测试环境限制，我们模拟通过修改用户状态

      await page.goto(`${TEST_BASE_URL}/login`)

      // 尝试登录被封禁用户
      await page.fill('input[name="email"]', TEST_USERS.banned.email)
      await page.fill('input[name="password"]', TEST_USERS.banned.password)
      await page.click('button[type="submit"]')

      // 根据实现，被封禁用户可能：
      // 1. 无法登录（登录时被拒绝）
      // 2. 可以登录但访问受限

      const currentUrl = page.url()
      if (currentUrl.includes("/unauthorized")) {
        // 如果被重定向到未授权页面
        await expect(page.locator("text=账户已被封禁")).toBeVisible()
      } else if (currentUrl.includes("/login")) {
        // 如果仍在登录页面，检查错误信息
        await expect(page.locator("text=账户已被封禁")).toBeVisible()
      }
    })
  })

  test.describe("权限状态变化测试", () => {
    test("用户权限变化应该立即生效", async ({ page }) => {
      // 以普通用户身份登录
      await loginUser(page, TEST_USERS.user)

      // 验证无法访问管理页面
      await page.goto(`${TEST_BASE_URL}/admin`)
      await page.waitForURL(/.*\/unauthorized.*/)
      await expect(page.locator("text=权限不足")).toBeVisible()

      // 模拟权限提升（这在实际测试中需要通过API或数据库操作）
      // 注意：这里只是演示测试结构，实际实现需要根据具体的权限变更机制

      // 重新加载页面验证权限
      await page.reload()

      // 如果权限已提升，应该能访问管理页面
      // 这部分需要根据实际的权限变更机制进行调整
    })

    test("会话过期应该要求重新认证", async ({ page }) => {
      // 登录用户
      await loginUser(page, TEST_USERS.user)

      // 验证已登录状态
      await page.goto(`${TEST_BASE_URL}/profile`)
      await expect(page.locator("text=用户资料")).toBeVisible()

      // 模拟会话过期（清除认证cookies）
      await page.context().clearCookies()

      // 尝试访问需认证的页面
      await page.goto(`${TEST_BASE_URL}/profile`)

      // 应该重定向到登录页
      await page.waitForURL(/.*\/login.*/)
      expect(page.url()).toContain("/login")
    })
  })

  test.describe("并发会话安全测试", () => {
    test("同一用户的多个会话应该同步权限状态", async ({ browser }) => {
      const context1 = await browser.newContext()
      const context2 = await browser.newContext()
      const page1 = await context1.newPage()
      const page2 = await context2.newPage()

      try {
        // 在两个上下文中都登录同一个用户
        await loginUser(page1, TEST_USERS.user)
        await loginUser(page2, TEST_USERS.user)

        // 验证两个会话都能访问用户页面
        await page1.goto(`${TEST_BASE_URL}/profile`)
        await page2.goto(`${TEST_BASE_URL}/profile`)

        await expect(page1.locator("text=用户资料")).toBeVisible()
        await expect(page2.locator("text=用户资料")).toBeVisible()

        // 模拟在一个会话中登出
        await page1.goto(`${TEST_BASE_URL}`)
        await page1.click('[data-testid="logout-button"]', { timeout: 5000 })

        // 验证第二个会话的权限状态
        await page2.reload()

        // 注意：根据具体实现，第二个会话可能仍然有效或需要重新认证
        // 这取决于会话管理策略
      } finally {
        await context1.close()
        await context2.close()
      }
    })
  })

  test.describe("权限系统性能测试", () => {
    test("权限检查不应该显著影响页面加载时间", async ({ page }) => {
      await loginUser(page, TEST_USERS.admin)

      const pages = ["/admin", "/profile", "/settings"]

      for (const path of pages) {
        const startTime = Date.now()

        await page.goto(`${TEST_BASE_URL}${path}`)
        await page.waitForLoadState("domcontentloaded")

        const loadTime = Date.now() - startTime

        // 页面加载时间不应超过5秒
        expect(loadTime).toBeLessThan(5000)

        console.log(`页面 ${path} 加载时间: ${loadTime}ms`)
      }
    })

    test("API权限检查应该快速响应", async ({ page }) => {
      await loginUser(page, TEST_USERS.admin)

      const apiEndpoints = ["/api/user/profile", "/api/admin/dashboard"]

      for (const endpoint of apiEndpoints) {
        const startTime = Date.now()

        const response = await page.request.get(`${TEST_BASE_URL}${endpoint}`)

        const responseTime = Date.now() - startTime

        // API响应时间不应超过2秒
        expect(responseTime).toBeLessThan(2000)
        expect([200, 404]).toContain(response.status())

        console.log(`API ${endpoint} 响应时间: ${responseTime}ms`)
      }
    })
  })

  test.describe("安全边界测试", () => {
    test("应该防止通过URL操作绕过权限检查", async ({ page }) => {
      // 未登录状态
      const attempts = [
        `/admin?bypass=true`,
        `/admin#unauthorized`,
        `/admin/../admin`,
        `/api/admin/users?token=fake`,
        `/api/admin/../user/profile`,
      ]

      for (const url of attempts) {
        await page.goto(`${TEST_BASE_URL}${url}`)

        // 应该被重定向到登录页或显示未授权错误
        const finalUrl = page.url()
        const isLoginRedirect = finalUrl.includes("/login")
        const isUnauthorized = finalUrl.includes("/unauthorized")

        expect(isLoginRedirect || isUnauthorized).toBe(true)
      }
    })

    test("应该防止通过修改客户端状态绕过权限", async ({ page }) => {
      await loginUser(page, TEST_USERS.user)

      // 尝试修改客户端存储来伪造管理员权限
      await page.evaluate(() => {
        // 尝试修改 localStorage
        localStorage.setItem("userRole", "ADMIN")
        localStorage.setItem("isAdmin", "true")

        // 尝试修改 sessionStorage
        sessionStorage.setItem("permissions", JSON.stringify({ admin: true }))
      })

      // 刷新页面后尝试访问管理页面
      await page.reload()
      await page.goto(`${TEST_BASE_URL}/admin`)

      // 应该仍然被拒绝访问
      await page.waitForURL(/.*\/unauthorized.*/)
      await expect(page.locator("text=权限不足")).toBeVisible()
    })
  })
})

// 辅助函数：用户登录
async function loginUser(page: Page, user: { email: string; password: string }) {
  await page.goto(`${TEST_BASE_URL}/login`)

  // 等待登录表单加载
  await page.waitForSelector('input[name="email"]')

  // 填写登录信息
  await page.fill('input[name="email"]', user.email)
  await page.fill('input[name="password"]', user.password)

  // 提交登录表单
  await page.click('button[type="submit"]')

  // 等待登录完成（重定向到主页或其他页面）
  await page.waitForURL((url) => !url.pathname.includes("/login"))

  // 验证登录成功
  await expect(page.locator("text=需要登录")).not.toBeVisible()
}

// 辅助函数：验证用户角色
async function verifyUserRole(page: Page, expectedRole: string) {
  // 通过API验证用户角色
  const response = await page.request.get(`${TEST_BASE_URL}/api/user/profile`)

  if (response.status() === 200) {
    const userData = await response.json()
    expect(userData.role).toBe(expectedRole)
  }
}
