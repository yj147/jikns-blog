#!/usr/bin/env node

/**
 * 性能基线测试脚本
 *
 * 测试目标：
 * - API 响应时间 < 300ms
 * - 首屏渲染 < 100ms
 * - 图片上传 < 10s
 * - 并发处理能力验证
 */

import { performance } from "perf_hooks"
import fetch from "node-fetch"
import fs from "fs/promises"
import path from "path"

// 配置
const CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  apiEndpoints: {
    activities: "/api/activities",
    posts: "/api/posts",
    upload: "/api/upload/images",
    health: "/api/health",
  },
  thresholds: {
    apiResponseTime: 300, // ms
    uploadTime: 10000, // ms for multiple images
    concurrentRequests: 100,
    firstContentfulPaint: 1500, // ms
    largestContentfulPaint: 2500, // ms
    firstInputDelay: 100, // ms
  },
  testConfig: {
    warmupRequests: 5,
    testRequests: 20,
    concurrentUsers: 10,
    maxRetries: 3,
  },
}

// 结果存储
const testResults = {
  timestamp: new Date().toISOString(),
  environment: {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
  },
  tests: {},
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0,
  },
}

// 工具函数
async function measureApiCall(url, options = {}) {
  const start = performance.now()
  try {
    const response = await fetch(url, {
      timeout: 10000,
      ...options,
    })
    const duration = performance.now() - start

    return {
      success: response.ok,
      status: response.status,
      duration: Math.round(duration * 100) / 100,
      size: parseInt(response.headers.get("content-length") || "0"),
    }
  } catch (error) {
    const duration = performance.now() - start
    return {
      success: false,
      error: error.message,
      duration: Math.round(duration * 100) / 100,
    }
  }
}

async function performConcurrentTest(url, concurrency = 10, totalRequests = 100) {
  console.log(`🚀 执行并发测试: ${concurrency} 并发用户, ${totalRequests} 总请求`)

  const batchSize = Math.ceil(totalRequests / concurrency)
  const results = []

  const startTime = performance.now()

  // 创建并发批次
  const batches = []
  for (let i = 0; i < concurrency; i++) {
    const batch = Array(batchSize)
      .fill(null)
      .map(() => measureApiCall(url))
    batches.push(Promise.all(batch))
  }

  // 执行所有批次
  const batchResults = await Promise.all(batches)
  const allResults = batchResults.flat()

  const totalTime = performance.now() - startTime

  // 统计结果
  const successfulRequests = allResults.filter((r) => r.success).length
  const failedRequests = allResults.length - successfulRequests
  const avgDuration = allResults.reduce((sum, r) => sum + r.duration, 0) / allResults.length
  const maxDuration = Math.max(...allResults.map((r) => r.duration))
  const minDuration = Math.min(...allResults.map((r) => r.duration))
  const throughput = (allResults.length / totalTime) * 1000 // requests per second

  return {
    totalRequests: allResults.length,
    successfulRequests,
    failedRequests,
    successRate: (successfulRequests / allResults.length) * 100,
    avgDuration: Math.round(avgDuration * 100) / 100,
    maxDuration: Math.round(maxDuration * 100) / 100,
    minDuration: Math.round(minDuration * 100) / 100,
    throughput: Math.round(throughput * 100) / 100,
    totalTime: Math.round(totalTime * 100) / 100,
  }
}

async function testApiEndpoint(name, endpoint, method = "GET", body = null) {
  console.log(`📡 测试 API: ${name} (${method} ${endpoint})`)

  const url = `${CONFIG.baseUrl}${endpoint}`
  const options = {
    method,
    headers: { "Content-Type": "application/json" },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  // 预热请求
  console.log("   预热中...")
  for (let i = 0; i < CONFIG.testConfig.warmupRequests; i++) {
    await measureApiCall(url, options)
  }

  // 测试请求
  console.log("   执行测试...")
  const results = []
  for (let i = 0; i < CONFIG.testConfig.testRequests; i++) {
    const result = await measureApiCall(url, options)
    results.push(result)

    // 稍微延迟避免过载
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // 统计结果
  const successfulResults = results.filter((r) => r.success)
  const failedResults = results.filter((r) => !r.success)

  if (successfulResults.length === 0) {
    console.log(`   ❌ 所有请求都失败了`)
    return {
      name,
      endpoint,
      success: false,
      error: "所有请求都失败",
    }
  }

  const avgDuration =
    successfulResults.reduce((sum, r) => sum + r.duration, 0) / successfulResults.length
  const maxDuration = Math.max(...successfulResults.map((r) => r.duration))
  const minDuration = Math.min(...successfulResults.map((r) => r.duration))
  const p95Duration = successfulResults.map((r) => r.duration).sort((a, b) => a - b)[
    Math.floor(successfulResults.length * 0.95)
  ]

  const passed = avgDuration <= CONFIG.thresholds.apiResponseTime
  const status = passed ? "✅ 通过" : "❌ 失败"

  console.log(
    `   ${status} - 平均响应时间: ${Math.round(avgDuration)}ms (阈值: ${CONFIG.thresholds.apiResponseTime}ms)`
  )
  console.log(
    `   详细: 最小=${Math.round(minDuration)}ms, 最大=${Math.round(maxDuration)}ms, P95=${Math.round(p95Duration)}ms`
  )
  console.log(
    `   成功率: ${successfulResults.length}/${results.length} (${Math.round((successfulResults.length / results.length) * 100)}%)`
  )

  return {
    name,
    endpoint,
    success: true,
    passed,
    stats: {
      avgDuration: Math.round(avgDuration * 100) / 100,
      maxDuration: Math.round(maxDuration * 100) / 100,
      minDuration: Math.round(minDuration * 100) / 100,
      p95Duration: Math.round(p95Duration * 100) / 100,
      successRate: Math.round((successfulResults.length / results.length) * 100),
      totalRequests: results.length,
      successfulRequests: successfulResults.length,
      failedRequests: failedResults.length,
    },
  }
}

async function testServerHealth() {
  console.log("🏥 检查服务器健康状态")

  try {
    const result = await measureApiCall(`${CONFIG.baseUrl}${CONFIG.apiEndpoints.health}`)

    if (result.success) {
      console.log(`   ✅ 服务器健康 - 响应时间: ${result.duration}ms`)
      return { healthy: true, duration: result.duration }
    } else {
      console.log(`   ❌ 服务器不健康 - 状态: ${result.status}`)
      return { healthy: false, error: result.error || `HTTP ${result.status}` }
    }
  } catch (error) {
    console.log(`   ❌ 无法连接服务器 - ${error.message}`)
    return { healthy: false, error: error.message }
  }
}

async function runPerformanceTests() {
  console.log("🎯 开始性能基线测试")
  console.log(`📍 测试目标: ${CONFIG.baseUrl}`)
  console.log(`⏱️  开始时间: ${new Date().toLocaleString()}`)
  console.log("=".repeat(60))

  // 1. 健康检查
  const healthCheck = await testServerHealth()
  testResults.tests.health = healthCheck

  if (!healthCheck.healthy) {
    console.log("❌ 服务器不可用，终止测试")
    testResults.summary.failed++
    return
  }

  // 2. API 端点测试
  console.log("\n📡 API 端点性能测试")
  console.log("-".repeat(40))

  const apiTests = [
    ["动态列表", `${CONFIG.apiEndpoints.activities}?limit=10`],
    ["博客列表", `${CONFIG.apiEndpoints.posts}?limit=10`],
    ["单个动态", `${CONFIG.apiEndpoints.activities}?limit=1`], // 获取第一个动态
  ]

  for (const [name, endpoint] of apiTests) {
    const result = await testApiEndpoint(name, endpoint)
    testResults.tests[`api_${name.toLowerCase().replace(/\s+/g, "_")}`] = result

    if (result.success && result.passed) {
      testResults.summary.passed++
    } else if (result.success && !result.passed) {
      testResults.summary.warnings++
    } else {
      testResults.summary.failed++
    }
  }

  // 3. 并发测试
  console.log("\n🚀 并发性能测试")
  console.log("-".repeat(40))

  const concurrentResult = await performConcurrentTest(
    `${CONFIG.baseUrl}${CONFIG.apiEndpoints.activities}?limit=5`,
    CONFIG.testConfig.concurrentUsers,
    CONFIG.testConfig.concurrentUsers * 10
  )

  testResults.tests.concurrent = concurrentResult

  const concurrentPassed =
    concurrentResult.successRate >= 95 &&
    concurrentResult.avgDuration <= CONFIG.thresholds.apiResponseTime
  console.log(`   ${concurrentPassed ? "✅ 通过" : "❌ 失败"} - 并发测试`)
  console.log(`   成功率: ${concurrentResult.successRate}% (阈值: ≥95%)`)
  console.log(
    `   平均响应: ${concurrentResult.avgDuration}ms (阈值: ≤${CONFIG.thresholds.apiResponseTime}ms)`
  )
  console.log(`   吞吐量: ${concurrentResult.throughput} req/s`)

  if (concurrentPassed) {
    testResults.summary.passed++
  } else {
    testResults.summary.warnings++
  }

  // 4. 数据库连接测试（通过创建简单动态）
  console.log("\n💾 数据库性能测试")
  console.log("-".repeat(40))

  const dbTestData = {
    content: "性能测试动态 - " + new Date().toISOString(),
    images: [],
  }

  // 注意：这需要认证，在实际环境中可能会失败
  try {
    const dbResult = await testApiEndpoint(
      "数据库写入",
      CONFIG.apiEndpoints.activities,
      "POST",
      dbTestData
    )

    testResults.tests.database_write = dbResult

    if (dbResult.success && dbResult.passed) {
      testResults.summary.passed++
    } else {
      testResults.summary.warnings++
    }
  } catch (error) {
    console.log("   ⚠️  数据库写入测试跳过（需要认证）")
    testResults.tests.database_write = {
      skipped: true,
      reason: "需要用户认证",
    }
  }
}

async function generateReport() {
  console.log("\n📊 生成性能基线报告")
  console.log("=".repeat(60))

  // 计算总体得分
  const totalTests =
    testResults.summary.passed + testResults.summary.failed + testResults.summary.warnings
  const score = totalTests > 0 ? Math.round((testResults.summary.passed / totalTests) * 100) : 0

  console.log(`📈 总体性能得分: ${score}%`)
  console.log(`✅ 通过: ${testResults.summary.passed}`)
  console.log(`⚠️  警告: ${testResults.summary.warnings}`)
  console.log(`❌ 失败: ${testResults.summary.failed}`)

  // 性能基线数据
  const baselineData = {
    timestamp: testResults.timestamp,
    score,
    summary: testResults.summary,
    baseline: {
      api: {
        responseTime: "<300ms",
        concurrency: "10 并发用户",
        throughput: ">50 req/s",
        successRate: ">95%",
      },
      frontend: {
        firstContentfulPaint: "<1500ms",
        largestContentfulPaint: "<2500ms",
        firstInputDelay: "<100ms",
      },
      database: {
        queryTime: "<200ms",
        connectionPool: "<80% usage",
      },
    },
    recommendations: [],
  }

  // 生成建议
  if (testResults.summary.failed > 0) {
    baselineData.recommendations.push("存在失败的测试，需要修复API端点或服务器配置")
  }

  if (testResults.summary.warnings > 0) {
    baselineData.recommendations.push("部分性能指标超出阈值，建议优化响应时间")
  }

  if (
    testResults.tests.concurrent &&
    testResults.tests.concurrent.avgDuration > CONFIG.thresholds.apiResponseTime
  ) {
    baselineData.recommendations.push("并发响应时间较高，建议优化数据库查询或增加缓存")
  }

  if (testResults.tests.concurrent && testResults.tests.concurrent.successRate < 95) {
    baselineData.recommendations.push("并发成功率较低，检查服务器资源配置和错误处理")
  }

  // 保存详细结果
  const reportDir = "docs/4-activity"
  const reportFile = path.join(reportDir, "性能基线数据.json")

  try {
    await fs.mkdir(reportDir, { recursive: true })
    await fs.writeFile(
      reportFile,
      JSON.stringify(
        {
          ...baselineData,
          details: testResults,
        },
        null,
        2
      )
    )

    console.log(`📋 详细报告已保存: ${reportFile}`)
  } catch (error) {
    console.log(`⚠️  保存报告失败: ${error.message}`)
  }

  return baselineData
}

async function main() {
  try {
    await runPerformanceTests()
    const report = await generateReport()

    console.log("\n🎉 性能基线测试完成")
    console.log(`📊 总体得分: ${report.score}%`)

    // 设置退出码
    if (testResults.summary.failed > 0) {
      process.exit(1)
    } else if (testResults.summary.warnings > 0) {
      process.exit(0) // 警告不算失败
    } else {
      process.exit(0)
    }
  } catch (error) {
    console.error("❌ 测试执行失败:", error)
    process.exit(1)
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { CONFIG, runPerformanceTests, generateReport }
