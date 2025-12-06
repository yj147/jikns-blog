# E2E 自动化测试 - Development Plan

## Overview
为 jikns_blog 项目构建完整的端到端自动化测试体系，覆盖认证、交互、通知、用户中心和管理功能五大核心模块，确保关键用户流程的稳定性和可靠性。

## Task Breakdown

### Task 1: 认证流程测试
- **ID**: task-1
- **Description**: 实现邮箱登录/登出、OAuth GitHub、会话管理和受保护路由的自动化测试，确保认证系统的安全性和可用性
- **File Scope**: tests/e2e/auth/**
- **Dependencies**: None
- **Test Command**: `pnpm test:e2e tests/e2e/auth`
- **Test Focus**:
  - **登录流程**：邮箱登录、OAuth GitHub 登录、错误凭证处理
  - **会话管理**：会话持久化、跨页面会话状态、会话过期
  - **受保护路由**：未登录访问重定向、登录后访问成功
  - **登出流程**：登出后清除会话、重定向到首页

  **Chrome DevTools MCP 调用序列**：
  ```
  1. navigate("http://localhost:3999/login/email")
  2. fill("input#email", "admin@example.com")
  3. fill("input#password", "admin123456")
  4. click("button[type='submit']")
  5. snapshot() // 验证登录成功后的页面
  6. navigate("http://localhost:3999/profile")
  7. snapshot() // 验证受保护路由可访问
  ```

  **Playwright 测试代码结构**：
  ```typescript
  // tests/e2e/auth/login.spec.ts
  test.describe('邮箱登录流程', () => {
    test('成功登录', async ({ page }) => {
      await login(page, { email: 'admin@example.com', password: 'admin123456' })
      await expect(page).toHaveURL(/\/(feed|profile)/)
    })

    test('错误凭证处理', async ({ page }) => {
      await page.goto('/login/email')
      await page.fill('input#email', 'admin@example.com')
      await page.fill('input#password', 'wrongpassword')
      await page.click('button[type="submit"]')
      await waitForToast(page, /密码|凭证/)
    })
  })

  // tests/e2e/auth/protected-routes.spec.ts
  test.describe('受保护路由', () => {
    test('未登录访问重定向', async ({ page }) => {
      await ensureLoggedOut(page)
      await page.goto('/profile')
      await expect(page).toHaveURL(/\/login/)
    })
  })
  ```

### Task 2: 交互功能测试
- **ID**: task-2
- **Description**: 实现点赞、评论、关注/取消关注、发布动态的自动化测试，验证用户交互功能的完整性和实时性
- **File Scope**: tests/e2e/interactions/**
- **Dependencies**: depends on task-1 (需要登录状态)
- **Test Command**: `pnpm test:e2e tests/e2e/interactions`
- **Test Focus**:
  - **点赞功能**：点赞动态/文章、取消点赞、点赞数实时更新
  - **评论功能**：发布评论、编辑评论、删除评论、评论列表加载
  - **关注功能**：关注用户、取消关注、关注状态实时更新
  - **发布动态**：发布文本动态、发布带图片动态、发布后展示在 feed

  **Chrome DevTools MCP 调用序列**：
  ```
  1. navigate("http://localhost:3999/feed")
  2. click("button[data-testid='like-button']:first-of-type")
  3. snapshot() // 验证点赞数增加
  4. click("button[data-testid='comment-button']:first-of-type")
  5. fill("textarea[placeholder*='评论']", "这是一条测试评论")
  6. click("button[type='submit']")
  7. snapshot() // 验证评论出现在列表中
  ```

  **Playwright 测试代码结构**：
  ```typescript
  // tests/e2e/interactions/likes.spec.ts
  test.describe('点赞功能', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, { email: 'user@example.com', password: 'user123456' })
    })

    test('点赞动态', async ({ page }) => {
      await page.goto('/feed')
      const likeButton = page.locator('button[data-testid="like-button"]').first()
      const initialCount = await likeButton.textContent()
      await likeButton.click()
      await expect(likeButton).not.toContainText(initialCount!)
    })
  })

  // tests/e2e/interactions/comments.spec.ts
  test.describe('评论功能', () => {
    test('发布评论', async ({ page }) => {
      await page.goto('/feed')
      await page.click('button[data-testid="comment-button"]')
      await page.fill('textarea[placeholder*="评论"]', '测试评论内容')
      await page.click('button[type="submit"]')
      await waitForToast(page, /成功|发布/)
      await expect(page.getByText('测试评论内容')).toBeVisible()
    })
  })

  // tests/e2e/interactions/follow.spec.ts
  test.describe('关注功能', () => {
    test('关注用户', async ({ page }) => {
      await page.goto('/profile/some-user-id')
      const followButton = page.getByRole('button', { name: /关注/ })
      await followButton.click()
      await expect(followButton).toContainText(/已关注|取消/)
    })
  })
  ```

### Task 3: 通知与实时推送测试
- **ID**: task-3
- **Description**: 实现通知列表加载、实时通知推送、标记已读和 Realtime 订阅的自动化测试，验证通知系统的可靠性
- **File Scope**: tests/e2e/notifications/**
- **Dependencies**: depends on task-1 (需要登录状态)
- **Test Command**: `pnpm test:e2e tests/e2e/notifications`
- **Test Focus**:
  - **通知列表**：加载历史通知、分页加载、空状态展示
  - **实时推送**：新通知实时出现、通知铃铛数字更新
  - **标记已读**：单条标记已读、全部标记已读
  - **Realtime 订阅**：订阅建立、数据推送、订阅断开重连

  **Chrome DevTools MCP 调用序列**：
  ```
  1. navigate("http://localhost:3999/notifications")
  2. snapshot() // 验证通知列表加载
  3. click("button[data-testid='notification-item']:first-of-type")
  4. snapshot() // 验证单条标记已读
  5. click("button[data-testid='mark-all-read']")
  6. snapshot() // 验证全部标记已读
  ```

  **Playwright 测试代码结构**：
  ```typescript
  // tests/e2e/notifications/notification-list.spec.ts
  test.describe('通知列表', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, { email: 'admin@example.com', password: 'admin123456' })
    })

    test('加载历史通知', async ({ page }) => {
      await page.goto('/notifications')
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(greaterThan(0))
    })

    test('标记全部已读', async ({ page }) => {
      await page.goto('/notifications')
      await page.click('button[data-testid="mark-all-read"]')
      await waitForToast(page, /已读/)
      await expect(page.locator('.notification-unread')).toHaveCount(0)
    })
  })

  // tests/e2e/notifications/realtime-push.spec.ts
  test.describe('实时推送', () => {
    test('新通知实时出现', async ({ page, context }) => {
      // 用户1登录
      await login(page, { email: 'user@example.com', password: 'user123456' })
      await page.goto('/notifications')

      // 用户2触发通知（在新页面）
      const page2 = await context.newPage()
      await login(page2, { email: 'admin@example.com', password: 'admin123456' })
      await page2.goto('/profile/user-id')
      await page2.click('button[data-testid="like-button"]')

      // 验证用户1收到实时通知
      await expect(page.locator('[data-testid="notification-badge"]')).toContainText('1')
    })
  })
  ```

### Task 4: 用户中心测试
- **ID**: task-4
- **Description**: 实现个人资料页展示、编辑资料（头像、封面、简介）、隐私设置和账号设置的自动化测试，验证用户中心功能的完整性
- **File Scope**: tests/e2e/profile/**
- **Dependencies**: depends on task-1 (需要登录状态)
- **Test Command**: `pnpm test:e2e tests/e2e/profile`
- **Test Focus**:
  - **资料展示**：用户名、简介、头像、封面图、统计数据展示
  - **编辑资料**：修改用户名、上传头像、上传封面、修改简介
  - **隐私设置**：资料可见性、活动隐私、关注列表隐私
  - **账号设置**：邮箱验证、密码修改、账号注销

  **Chrome DevTools MCP 调用序列**：
  ```
  1. navigate("http://localhost:3999/profile")
  2. snapshot() // 验证资料页展示
  3. click("button[data-testid='edit-profile']")
  4. fill("input[name='username']", "新用户名")
  5. fill("textarea[name='bio']", "这是我的新简介")
  6. click("button[type='submit']")
  7. snapshot() // 验证修改成功
  8. navigate("http://localhost:3999/settings")
  9. click("input[name='profileVisibility']")
  10. click("button[type='submit']")
  11. snapshot() // 验证隐私设置生效
  ```

  **Playwright 测试代码结构**：
  ```typescript
  // tests/e2e/profile/profile-display.spec.ts
  test.describe('个人资料展示', () => {
    test('展示完整资料信息', async ({ page }) => {
      await login(page, { email: 'admin@example.com', password: 'admin123456' })
      await page.goto('/profile')
      await expect(page.locator('[data-testid="username"]')).toBeVisible()
      await expect(page.locator('[data-testid="bio"]')).toBeVisible()
      await expect(page.locator('[data-testid="stats"]')).toBeVisible()
    })
  })

  // tests/e2e/profile/edit-profile.spec.ts
  test.describe('编辑资料', () => {
    test('修改用户名和简介', async ({ page }) => {
      const newUsername = randomUsername('valid')
      const newBio = randomBio('valid')

      await page.goto('/settings')
      await page.fill('input[name="username"]', newUsername)
      await page.fill('textarea[name="bio"]', newBio)
      await page.click('button[type="submit"]')
      await waitForToast(page, /成功|保存/)

      await page.goto('/profile')
      await expect(page.locator('[data-testid="username"]')).toContainText(newUsername)
    })
  })

  // tests/e2e/profile/privacy-settings.spec.ts
  test.describe('隐私设置', () => {
    test('修改资料可见性', async ({ page }) => {
      await page.goto('/settings')
      await page.click('text=隐私设置')
      await page.click('input[name="profileVisibility"]')
      await page.click('button[type="submit"]')
      await waitForToast(page, /成功/)
    })
  })
  ```

### Task 5: 管理功能测试
- **ID**: task-5
- **Description**: 实现管理后台访问权限、文章管理 CRUD 和监控中心数据展示的自动化测试，验证管理功能的权限控制和数据准确性
- **File Scope**: tests/e2e/admin/**
- **Dependencies**: depends on task-1 (需要管理员登录)
- **Test Command**: `pnpm test:e2e tests/e2e/admin`
- **Test Focus**:
  - **访问权限**：管理员可访问、普通用户被拒绝、未登录重定向
  - **文章管理**：创建文章、编辑文章、删除文章、文章列表过滤
  - **监控中心**：系统指标展示、用户统计、错误日志查看
  - **批量操作**：批量删除、批量发布、批量归档

  **Chrome DevTools MCP 调用序列**：
  ```
  1. navigate("http://localhost:3999/admin")
  2. snapshot() // 验证管理员可访问
  3. click("a[href='/admin/blog/create']")
  4. fill("input[name='title']", "测试文章标题")
  5. fill("textarea[name='content']", "这是测试文章内容")
  6. click("button[type='submit']")
  7. snapshot() // 验证文章创建成功
  8. navigate("http://localhost:3999/admin/monitoring")
  9. snapshot() // 验证监控数据展示
  ```

  **Playwright 测试代码结构**：
  ```typescript
  // tests/e2e/admin/access-control.spec.ts
  test.describe('管理后台访问权限', () => {
    test('管理员可访问', async ({ page }) => {
      await login(page, { email: 'admin@example.com', password: 'admin123456' })
      await page.goto('/admin')
      await expect(page).toHaveURL(/\/admin/)
      await expect(page.locator('h1')).toContainText(/管理|后台|Admin/)
    })

    test('普通用户被拒绝', async ({ page }) => {
      await login(page, { email: 'user@example.com', password: 'user123456' })
      await page.goto('/admin')
      await expect(page).toHaveURL(/\/unauthorized|\/403/)
    })
  })

  // tests/e2e/admin/post-management.spec.ts
  test.describe('文章管理', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, { email: 'admin@example.com', password: 'admin123456' })
    })

    test('创建文章', async ({ page }) => {
      await page.goto('/admin/blog/create')
      await page.fill('input[name="title"]', '测试文章标题')
      await page.fill('textarea[name="excerpt"]', '文章摘要')
      // 富文本编辑器填充（可能需要特殊处理）
      await page.click('button[type="submit"]')
      await waitForToast(page, /成功|发布/)
    })

    test('编辑文章', async ({ page }) => {
      await page.goto('/admin/blog')
      await page.click('button[data-testid="edit-post"]:first-of-type')
      await page.fill('input[name="title"]', '修改后的标题')
      await page.click('button[type="submit"]')
      await waitForToast(page, /成功|保存/)
    })
  })

  // tests/e2e/admin/monitoring.spec.ts
  test.describe('监控中心', () => {
    test('展示系统指标', async ({ page }) => {
      await login(page, { email: 'admin@example.com', password: 'admin123456' })
      await page.goto('/admin/monitoring')
      await expect(page.locator('[data-testid="metrics-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="user-stats"]')).toBeVisible()
    })
  })
  ```

## Acceptance Criteria
- [ ] 所有5个测试模块的测试用例全部通过（无 flaky 测试）
- [ ] 测试覆盖所有关键用户流程：认证、交互、通知、用户中心、管理功能
- [ ] 每个测试用例都有明确的断言点，验证功能正确性和数据一致性
- [ ] Chrome DevTools MCP 调用序列与 Playwright 代码一致，可独立执行
- [ ] 测试可独立运行且可重复执行（无数据污染）
- [ ] 失败时自动截图，提供详细的错误信息
- [ ] 所有测试在 CI 环境中稳定运行（成功率 ≥95%）
- [ ] 测试执行时间合理（单个模块 <5 分钟）
- [ ] 测试代码使用 Page Object Model 模式，易于维护
- [ ] 测试覆盖关键路由的可访问性和响应性

## Technical Notes

### 测试环境配置
- **测试端口**：项目配置使用 `http://localhost:3999`（用户描述中提到的3998与实际配置不符）
- **测试账号**：
  - 管理员：admin@example.com / admin123456
  - 普通用户：user@example.com / user123456
- **环境变量**：测试时自动设置 `DISABLE_JIEBA=1` 和 `DISABLE_RATE_LIMIT=1`

### Chrome DevTools MCP 集成
- **调用顺序**：navigate → fill/click → snapshot
- **实时执行**：通过 MCP 调用序列可在 Chrome DevTools 中实时调试测试步骤
- **快照验证**：snapshot() 用于验证页面状态，对应 Playwright 的 expect() 断言

### Playwright 测试架构
- **Page Object Model**：将页面交互封装为独立的 Page Object 类，提高可维护性
- **测试工具库**：复用 `tests/e2e/utils/test-helpers.ts` 中的 `login`、`ensureLoggedOut`、`waitForToast` 等工具函数
- **会话管理**：使用 `storageState` 复用认证状态，减少重复登录
- **并行执行**：配置 `fullyParallel: true`，task-2/3/4 可并行执行，task-5 依赖 task-1

### 测试数据管理
- **数据隔离**：每个测试使用独立的测试数据，避免测试间相互影响
- **数据清理**：使用 `global-setup.ts` 和 `global-teardown.ts` 进行测试前准备和测试后清理
- **随机数据**：使用 `randomUsername`、`randomBio` 等函数生成随机测试数据，避免命名冲突

### 关键技术决策
1. **认证优先**：task-1 是其他所有测试的前置依赖，必须首先验证通过
2. **独立性**：task-2/3/4 设计为相互独立，可并行执行以缩短总测试时间
3. **权限隔离**：task-5 使用管理员账号，与其他测试隔离，避免权限混淆
4. **实时性验证**：task-3 使用多页面并发测试验证 Realtime 推送的实时性
5. **选择器策略**：优先使用 `data-testid` 属性，其次是角色和文本，避免依赖 CSS 类名
6. **失败处理**：配置 `screenshot: "only-on-failure"` 和 `video: "retain-on-failure"`，仅在失败时保存截图和视频
7. **超时配置**：全局超时60秒，操作超时30秒，导航超时60秒，根据实际情况调整
8. **浏览器选择**：主要在 Chromium 中测试，关键流程在 Firefox 和 Webkit 中验证兼容性

### 性能与稳定性
- **网络稳定性**：使用 `waitForLoadState("networkidle")` 确保页面完全加载
- **元素等待**：使用 Playwright 的自动等待机制，避免显式 `waitForTimeout`
- **重试机制**：CI 环境配置 `retries: 2`，本地不重试
- **并发限制**：CI 环境 workers: 1（串行），本地 workers: 4（并行）
