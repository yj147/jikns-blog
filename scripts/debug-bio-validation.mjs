import { chromium } from "@playwright/test"

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // 先登录
  await page.goto("http://localhost:3999/login/email")
  await page.waitForLoadState("networkidle")
  await page.fill("input#email", "user@example.com")
  await page.fill("input#password", "user123456")
  await page.click('button[type="submit"]')

  // 等待登录完成
  try {
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10000 })
    console.log("Login successful, URL:", page.url())
  } catch (e) {
    console.log("Login timeout, URL:", page.url())
    await browser.close()
    return
  }

  // 访问设置页
  await page.goto("http://localhost:3999/settings")
  await page.waitForLoadState("networkidle")
  console.log("Settings page loaded")

  // 清空 bio 并填入 501 个字符
  const bioInput = page.locator('textarea[name="bio"]')
  await bioInput.clear()
  const longBio = "A".repeat(501)
  await bioInput.fill(longBio)
  console.log("Filled bio with", longBio.length, "chars")

  // 点击保存
  await page.click('button:has-text("保存个人资料")')
  await page.waitForTimeout(2000)

  // 检查页面上的错误消息
  const html = await page.content()
  if (html.includes("超过") || html.includes("500字符")) {
    console.log("Found error message related to 500")
    const errorText = await page
      .locator("text=/超过|500/")
      .first()
      .textContent()
      .catch(() => null)
    console.log("Error text:", errorText)
  } else {
    console.log("No error message found in HTML")
  }

  // 检查表单错误
  const formMessage = await page
    .locator('[data-slot="form-message"]')
    .first()
    .textContent()
    .catch(() => null)
  console.log("Form message:", formMessage)

  // 截图
  await page.screenshot({ path: "/tmp/bio-test.png" })
  console.log("Screenshot saved to /tmp/bio-test.png")

  await browser.close()
}

main().catch(console.error)
