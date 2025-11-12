#!/usr/bin/env tsx
/**
 * 评论 API 性能测量脚本
 * 用于测量和记录评论 API 的性能基线
 */

import { performance } from "perf_hooks"

// 配置
const API_BASE = process.env.API_BASE || "http://localhost:3999"
const AUTH_TOKEN = process.env.AUTH_TOKEN || ""
const ITERATIONS = parseInt(process.env.ITERATIONS || "10")

// 测试数据
const TEST_DATA = {
  posts: ["test-post-1", "test-post-2", "test-post-3"],
  activities: ["test-activity-1", "test-activity-2"],
  comments: {
    short: "This is a short comment.",
    medium:
      "This is a medium-length comment that contains more text to test the performance with different content sizes. It helps us understand how the API handles various payload sizes.",
    long: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(15),
  },
}

// 统计结果
interface TestResult {
  operation: string
  times: number[]
  p50?: number
  p95?: number
  p99?: number
  avg?: number
  min?: number
  max?: number
}

const results: TestResult[] = []

// 辅助函数
function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function analyzeResults(result: TestResult): void {
  const times = result.times
  if (times.length === 0) return

  result.min = Math.min(...times)
  result.max = Math.max(...times)
  result.avg = times.reduce((a, b) => a + b, 0) / times.length
  result.p50 = calculatePercentile(times, 50)
  result.p95 = calculatePercentile(times, 95)
  result.p99 = calculatePercentile(times, 99)
}

function formatTime(ms: number): string {
  return `${ms.toFixed(2)}ms`
}

// 测试函数
async function measureRequest(
  name: string,
  method: string,
  url: string,
  options: RequestInit = {}
): Promise<number> {
  const start = performance.now()

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      console.error(`Request failed: ${response.status} ${response.statusText}`)
      return -1
    }

    await response.json()
    const duration = performance.now() - start
    return duration
  } catch (error) {
    console.error(`Request error:`, error)
    return -1
  }
}

// 测试场景
async function testListComments() {
  console.log("\n📋 Testing GET /api/comments (List)...")

  // 场景1: 10条评论无嵌套
  const result10: TestResult = { operation: "GET /api/comments (10 items)", times: [] }
  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measureRequest(
      "List 10 comments",
      "GET",
      `${API_BASE}/api/comments?targetType=post&targetId=${TEST_DATA.posts[0]}&limit=10`
    )
    if (time > 0) result10.times.push(time)
    process.stdout.write(".")
  }
  analyzeResults(result10)
  results.push(result10)

  // 场景2: 10条评论含回复
  const result10WithReplies: TestResult = {
    operation: "GET /api/comments (10 items + replies)",
    times: [],
  }
  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measureRequest(
      "List 10 comments with replies",
      "GET",
      `${API_BASE}/api/comments?targetType=post&targetId=${TEST_DATA.posts[0]}&limit=10&includeReplies=true`
    )
    if (time > 0) result10WithReplies.times.push(time)
    process.stdout.write(".")
  }
  analyzeResults(result10WithReplies)
  results.push(result10WithReplies)

  // 场景3: 50条评论无嵌套
  const result50: TestResult = { operation: "GET /api/comments (50 items)", times: [] }
  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measureRequest(
      "List 50 comments",
      "GET",
      `${API_BASE}/api/comments?targetType=post&targetId=${TEST_DATA.posts[1]}&limit=50`
    )
    if (time > 0) result50.times.push(time)
    process.stdout.write(".")
  }
  analyzeResults(result50)
  results.push(result50)

  console.log(" Done!")
}

async function testCreateComment() {
  console.log("\n✏️  Testing POST /api/comments (Create)...")

  // 场景1: 短评论
  const resultShort: TestResult = { operation: "POST /api/comments (short)", times: [] }
  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measureRequest("Create short comment", "POST", `${API_BASE}/api/comments`, {
      body: JSON.stringify({
        targetType: "post",
        targetId: TEST_DATA.posts[0],
        content: TEST_DATA.comments.short,
      }),
    })
    if (time > 0) resultShort.times.push(time)
    process.stdout.write(".")
  }
  analyzeResults(resultShort)
  results.push(resultShort)

  // 场景2: 中等评论
  const resultMedium: TestResult = { operation: "POST /api/comments (medium)", times: [] }
  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measureRequest("Create medium comment", "POST", `${API_BASE}/api/comments`, {
      body: JSON.stringify({
        targetType: "post",
        targetId: TEST_DATA.posts[1],
        content: TEST_DATA.comments.medium,
      }),
    })
    if (time > 0) resultMedium.times.push(time)
    process.stdout.write(".")
  }
  analyzeResults(resultMedium)
  results.push(resultMedium)

  // 场景3: 长评论
  const resultLong: TestResult = { operation: "POST /api/comments (long)", times: [] }
  for (let i = 0; i < ITERATIONS; i++) {
    const time = await measureRequest("Create long comment", "POST", `${API_BASE}/api/comments`, {
      body: JSON.stringify({
        targetType: "post",
        targetId: TEST_DATA.posts[2],
        content: TEST_DATA.comments.long,
      }),
    })
    if (time > 0) resultLong.times.push(time)
    process.stdout.write(".")
  }
  analyzeResults(resultLong)
  results.push(resultLong)

  console.log(" Done!")
}

async function testDeleteComment() {
  console.log("\n🗑️  Testing DELETE /api/comments/[id]...")

  // 创建一些评论用于删除
  const commentIds: string[] = []

  // 先创建评论
  console.log("  Creating test comments...")
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const response = await fetch(`${API_BASE}/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          targetType: "post",
          targetId: TEST_DATA.posts[0],
          content: `Test comment for deletion ${i}`,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.data?.id) {
          commentIds.push(data.data.id)
        }
      }
    } catch (error) {
      console.error("Failed to create test comment:", error)
    }
  }

  // 测试删除
  const resultDelete: TestResult = { operation: "DELETE /api/comments/[id]", times: [] }
  for (const commentId of commentIds) {
    const time = await measureRequest(
      "Delete comment",
      "DELETE",
      `${API_BASE}/api/comments/${commentId}`
    )
    if (time > 0) resultDelete.times.push(time)
    process.stdout.write(".")
  }
  analyzeResults(resultDelete)
  results.push(resultDelete)

  console.log(" Done!")
}

// 打印结果
function printResults() {
  console.log("\n" + "=".repeat(80))
  console.log("📊 Performance Test Results")
  console.log("=".repeat(80))

  console.log(`\nTest Configuration:`)
  console.log(`  API Base: ${API_BASE}`)
  console.log(`  Iterations: ${ITERATIONS}`)
  console.log(`  Timestamp: ${new Date().toISOString()}`)

  console.log("\n" + "-".repeat(80))

  results.forEach((result) => {
    if (result.times.length === 0) {
      console.log(`\n❌ ${result.operation}: No successful measurements`)
      return
    }

    console.log(`\n📈 ${result.operation}`)
    console.log(`  Samples: ${result.times.length}`)
    console.log(`  Min: ${formatTime(result.min!)}`)
    console.log(`  Max: ${formatTime(result.max!)}`)
    console.log(`  Avg: ${formatTime(result.avg!)}`)
    console.log(`  P50: ${formatTime(result.p50!)}`)
    console.log(`  P95: ${formatTime(result.p95!)}`)
    console.log(`  P99: ${formatTime(result.p99!)}`)
  })

  console.log("\n" + "=".repeat(80))

  // 导出 CSV
  console.log("\n📄 CSV Export:")
  console.log("Operation,Samples,Min,Max,Avg,P50,P95,P99")
  results.forEach((result) => {
    if (result.times.length > 0) {
      console.log(
        `"${result.operation}",${result.times.length},${result.min?.toFixed(2)},${result.max?.toFixed(2)},${result.avg?.toFixed(2)},${result.p50?.toFixed(2)},${result.p95?.toFixed(2)},${result.p99?.toFixed(2)}`
      )
    }
  })

  // 性能评估
  console.log("\n" + "-".repeat(80))
  console.log("🎯 Performance Assessment:")

  results.forEach((result) => {
    if (result.times.length === 0) return

    const p50 = result.p50!
    const p95 = result.p95!

    let status = "✅"
    let message = "Good"

    if (result.operation.includes("GET")) {
      if (p50 > 100) status = "⚠️"
      if (p50 > 200) status = "❌"
      if (p95 > 300) status = "⚠️"
      if (p95 > 500) status = "❌"
    } else if (result.operation.includes("POST")) {
      if (p50 > 50) status = "⚠️"
      if (p50 > 100) status = "❌"
      if (p95 > 100) status = "⚠️"
      if (p95 > 200) status = "❌"
    } else if (result.operation.includes("DELETE")) {
      if (p50 > 25) status = "⚠️"
      if (p50 > 50) status = "❌"
      if (p95 > 50) status = "⚠️"
      if (p95 > 100) status = "❌"
    }

    if (status === "⚠️") message = "Warning - approaching threshold"
    if (status === "❌") message = "Critical - exceeds threshold"

    console.log(`  ${status} ${result.operation}: ${message}`)
  })

  console.log("\n" + "=".repeat(80))
}

// 访问指标端点
async function fetchMetrics() {
  try {
    const response = await fetch(`${API_BASE}/api/comments/metrics`)
    if (response.ok) {
      const metrics = await response.json()
      console.log("\n📊 Live Metrics from API:")
      console.log(JSON.stringify(metrics, null, 2))
    }
  } catch (error) {
    // 指标端点可能未实现，忽略错误
  }
}

// 主函数
async function main() {
  console.log("🚀 Starting Comments API Performance Test")
  console.log("=".repeat(80))

  // 检查连接
  console.log("\n🔍 Checking API connectivity...")
  try {
    const response = await fetch(`${API_BASE}/api/health`)
    if (!response.ok) {
      console.error("❌ API is not responding. Please ensure the server is running.")
      process.exit(1)
    }
    console.log("✅ API is reachable")
  } catch (error) {
    console.error("❌ Cannot connect to API:", error)
    process.exit(1)
  }

  // 运行测试
  await testListComments()
  await testCreateComment()

  if (AUTH_TOKEN) {
    await testDeleteComment()
  } else {
    console.log("\n⚠️  Skipping DELETE tests (no auth token provided)")
  }

  // 打印结果
  printResults()

  // 获取实时指标
  await fetchMetrics()

  console.log("\n✅ Performance test completed!")
}

// 运行
main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
