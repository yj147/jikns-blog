import { expect, type ConsoleMessage, type Page } from "@playwright/test"
import { mkdirSync } from "fs"
import path from "path"

type CharsetOption = "alpha" | "numeric" | "alphanumeric" | "unicode" | "xss"

const ASCII_ALPHA = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
const ASCII_NUMERIC = "0123456789"
const ASCII_ALPHANUMERIC = `${ASCII_ALPHA}${ASCII_NUMERIC}`
const USERNAME_POOL = `${ASCII_ALPHANUMERIC}._`
const UNICODE_POOL = [
  "测试",
  "热爱",
  "博客",
  "创作",
  "技术",
  "🚀",
  "🔥",
  "🌊",
  "😊",
  "カフェ",
  "друг",
]
const TEST_RESULT_DIR = path.join(process.cwd(), "tests", "e2e", "test-results")
const consoleErrorBuffer = new WeakMap<Page, string[]>()

// 常见 XSS 向量，用于验证富文本/输入防护
export const XSS_VECTORS = [
  '<script>alert("xss")</script>',
  '"><img src=x onerror=alert(1)>',
  "javascript:alert('xss')",
  '{{constructor.constructor("alert(1)")()}}',
  "<svg onload=alert(1)>",
  "${7*7}",
  "<img src=x onerror=alert(document.domain)>",
  "<body onload=alert(1)>",
]

// 常见 SQL 注入向量，用于接口/输入防护测试
export const SQL_INJECTION_VECTORS = [
  "'; DROP TABLE users; --",
  "1' OR '1'='1",
  "' OR 1=1 --",
  "' UNION SELECT NULL,NULL,NULL --",
]

export interface TestResult {
  name: string
  status: "passed" | "failed" | "skipped"
  duration: number
  error?: string
  screenshot?: string
}

// 随机字符串生成（支持多字符集）
export function randomString(length: number, charset: CharsetOption = "alphanumeric"): string {
  if (length <= 0) return ""
  if (charset === "xss") {
    return sample(XSS_VECTORS)
  }

  if (charset === "unicode") {
    const tokens: string[] = []
    while (tokens.join("").length < length) {
      tokens.push(sample(UNICODE_POOL))
    }
    return tokens.join("").slice(0, length)
  }

  const pool =
    charset === "alpha" ? ASCII_ALPHA : charset === "numeric" ? ASCII_NUMERIC : ASCII_ALPHANUMERIC
  return randomChars(length, pool)
}

// 随机用户名（遵守 2-50 长度边界）
export function randomUsername(
  variant: "valid" | "too_short" | "too_long" | "boundary_min" | "boundary_max" = "valid"
): string {
  const build = (len: number) => randomChars(len, USERNAME_POOL)
  switch (variant) {
    case "too_short":
      return build(1)
    case "too_long":
      return build(60)
    case "boundary_min":
      return build(2)
    case "boundary_max":
      return build(50)
    case "valid":
    default:
      return build(randomBetween(6, 18))
  }
}

// 随机简介（覆盖 0-500 边界与特殊输入）
export function randomBio(
  variant: "valid" | "boundary_max" | "overflow" | "unicode" | "xss" = "valid"
): string {
  const words = ["热爱编码", "写博客", "旅行", "产品思考", "测试驱动", "社区分享", "阅读"]
  switch (variant) {
    case "boundary_max":
      return repeatText(words, 500)
    case "overflow":
      return repeatText(words, 520)
    case "unicode":
      return repeatText([...UNICODE_POOL, "开源", "贡献"], 240)
    case "xss":
      return sample(XSS_VECTORS)
    case "valid":
    default:
      return repeatText(words, randomBetween(40, 180))
  }
}

// 随机手机号（支持合法/非法格式）
export function randomPhone(valid = true): string {
  if (!valid) {
    const invalidPool = ["12345", "phone-xyz", "+1-12-abc", randomString(8, "alpha"), "++--", ""]
    return sample(invalidPool)
  }

  const country = sample(["+1", "+44", "+86", "+81", "+33"])
  const middle = randomChars(3, ASCII_NUMERIC)
  const tail = randomChars(4, ASCII_NUMERIC)
  return `${country}-${randomChars(3, ASCII_NUMERIC)}-${middle}-${tail}`
}

// 随机 URL（支持合法/非法格式）
export function randomUrl(valid = true): string {
  if (!valid) {
    const invalidPool = [
      "htp:/invalid-url",
      "javascript:alert('xss')",
      "example . com",
      "//missing-scheme.com",
      "",
    ]
    return sample(invalidPool)
  }

  const domain = sample(["example.com", "localhost:3999", "test.io", "dev.local"])
  const pathSegment = randomChars(6, ASCII_ALPHANUMERIC).toLowerCase()
  return `https://${domain}/${pathSegment}`
}

// 随机所在地（覆盖 0-200 边界）
export function randomLocation(
  variant: "valid" | "boundary_max" | "overflow" = "valid"
): string {
  const cities = ["北京", "上海", "深圳", "旧金山", "伦敦", "柏林", "东京", "新加坡", "杭州"]
  switch (variant) {
    case "boundary_max":
      return repeatText(cities, 200)
    case "overflow":
      return repeatText(cities, 220)
    case "valid":
    default:
      return repeatText(cities, randomBetween(5, 40))
  }
}

// 测试结果收集与输出
export class TestReporter {
  private results: TestResult[] = []

  // 记录单条用例结果
  record(result: TestResult): void {
    this.results.push(result)
  }

  // 汇总用例状态
  summary(): { total: number; passed: number; failed: number; skipped: number; duration: number } {
    return this.results.reduce(
      (acc, item) => {
        acc.total += 1
        acc.duration += item.duration
        if (item.status === "passed") acc.passed += 1
        if (item.status === "failed") acc.failed += 1
        if (item.status === "skipped") acc.skipped += 1
        return acc
      },
      { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 }
    )
  }

  // 导出 Markdown 报告
  toMarkdown(): string {
    const header = ["| 名称 | 状态 | 时长(ms) | 错误 | 截图 |", "| --- | --- | --- | --- | --- |"]
    const rows = this.results.map((item) => {
      const cleanError = item.error ? item.error.replace(/\|/g, "\\|") : ""
      const screenshot = item.screenshot ?? ""
      return `| ${item.name} | ${item.status} | ${item.duration} | ${cleanError} | ${screenshot} |`
    })
    return [...header, ...rows].join("\n")
  }

  // 导出 JSON 字符串
  toJson(): string {
    return JSON.stringify({ summary: this.summary(), results: this.results }, null, 2)
  }
}

// 登录辅助：统一的邮箱密码登录流程
export async function login(
  page: Page,
  user: { email: string; password: string }
): Promise<void> {
  await ensureLoggedOut(page)
  await page.goto("/login/email")
  await page.waitForLoadState("networkidle")

  const emailInput = page.locator("input#email")
  const passwordInput = page.locator("input#password")

  await emailInput.fill(user.email)
  await passwordInput.fill(user.password)

  const submitButton = page.getByRole("main").getByRole("button", { name: "登录", exact: true })
  await submitButton.click()

  await page.waitForLoadState("networkidle")
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 })
}

// 保证当前会话干净（登出）
export async function ensureLoggedOut(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

// 等待 toast/提示文案出现
export async function waitForToast(
  page: Page,
  text: string | RegExp,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? 5000
  const candidates = [
    page.locator("[data-sonner-toast]").filter({ hasText: text }),
    page.locator('[role="status"]').filter({ hasText: text }),
    page.locator('[role="alert"]').filter({ hasText: text }),
  ]

  for (const locator of candidates) {
    try {
      await expect(locator.first()).toBeVisible({ timeout })
      return
    } catch {
      // 尝试下一个候选
    }
  }

  await expect(page.getByText(text)).toBeVisible({ timeout })
}

// 断言页面无 console error（建议在测试开始时调用一次）
export async function expectNoConsoleErrors(page: Page): Promise<void> {
  let buffer = consoleErrorBuffer.get(page)
  if (!buffer) {
    buffer = []
    consoleErrorBuffer.set(page, buffer)
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") {
        buffer?.push(message.text())
      }
    })
  }

  await page.waitForTimeout(10)

  if (buffer.length > 0) {
    throw new Error(`控制台出现错误：\n${buffer.join("\n")}`)
  }
}

// 失败时捕获截图，返回文件路径（如果截取失败返回 undefined）
export async function captureScreenshotOnFailure(
  page: Page,
  testName: string
): Promise<string | undefined> {
  const safeName = testName.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
  const fileName = `${safeName || "failure"}-${Date.now()}.png`
  const filePath = path.join(TEST_RESULT_DIR, fileName)

  try {
    mkdirSync(TEST_RESULT_DIR, { recursive: true })
    await page.screenshot({ path: filePath, fullPage: true })
    return filePath
  } catch (error) {
    console.warn("[test-helpers] 截图失败", error)
    return undefined
  }
}

// ------------ 内部小工具（保持简单可测） ------------

function sample<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function randomChars(length: number, pool: string): string {
  let result = ""
  for (let i = 0; i < length; i += 1) {
    result += pool.charAt(Math.floor(Math.random() * pool.length))
  }
  return result
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function repeatText(pool: readonly string[], targetLength: number): string {
  if (targetLength <= 0) return ""
  let result = ""
  while (result.length < targetLength) {
    result += `${sample(pool)} `
  }
  return result.trim().slice(0, targetLength)
}
