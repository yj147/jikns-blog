/**
 * 关注列表分页逻辑验证脚本
 *
 * 验证内容：
 * 1. 首次请求包含 includeTotal=true 并返回 total
 * 2. 首次响应包含有效的 nextCursor
 * 3. 后续请求使用 cursor 参数
 * 4. 后续请求不包含 includeTotal 参数（避免重复 COUNT(*)）
 * 5. 最后一页 nextCursor 为 null
 * 6. hasMore 与 nextCursor 保持一致
 *
 * 运行方式：
 * pnpm tsx scripts/verify-follow-list-pagination.ts
 */

interface PaginationMeta {
  page: number
  limit: number
  total: number | null
  hasMore: boolean
  nextCursor: string | null
}

interface FollowListResponse {
  success: boolean
  data: Array<{
    id: string
    name: string | null
    avatarUrl: string | null
    bio: string | null
    status: string
    isMutual: boolean
    followedAt: string
  }>
  meta: {
    pagination: PaginationMeta
  }
}

async function fetchFollowList(
  userId: string,
  type: "followers" | "following",
  params: Record<string, string>
): Promise<FollowListResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3999"
  const queryString = new URLSearchParams(params).toString()
  const url = `${baseUrl}/api/users/${userId}/${type}?${queryString}`

  console.log(`\n📡 请求: ${url}`)

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`API 请求失败: ${error.error?.message || response.statusText}`)
  }

  return response.json()
}

async function verifyPaginationLogic(userId: string, type: "followers" | "following") {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`🔍 验证 ${type === "followers" ? "粉丝" : "关注"} 列表分页逻辑`)
  console.log(`${"=".repeat(60)}`)

  const issues: string[] = []
  const successes: string[] = []

  // 第一步：首次请求（应包含 includeTotal=true）
  console.log("\n【步骤 1】首次请求验证")
  const firstResponse = await fetchFollowList(userId, type, {
    limit: "20",
    includeTotal: "true",
  })

  console.log(`✓ 响应状态: ${firstResponse.success ? "成功" : "失败"}`)
  console.log(`✓ 数据条数: ${firstResponse.data.length}`)
  console.log(`✓ 分页信息:`, JSON.stringify(firstResponse.meta.pagination, null, 2))

  // 验证 1: total 应该存在
  if (firstResponse.meta.pagination.total === null) {
    issues.push("❌ 首次请求设置了 includeTotal=true，但 total 为 null")
  } else {
    successes.push(`✅ 首次请求返回 total: ${firstResponse.meta.pagination.total}`)
  }

  // 验证 2: 如果 total > limit，应该有 nextCursor
  const { total, limit, nextCursor, hasMore } = firstResponse.meta.pagination
  if (total !== null && total > limit) {
    if (!nextCursor) {
      issues.push("❌ total > limit，但 nextCursor 为 null")
    } else {
      successes.push(`✅ total > limit，nextCursor 存在: ${nextCursor}`)
    }

    if (!hasMore) {
      issues.push("❌ total > limit，但 hasMore 为 false")
    } else {
      successes.push("✅ total > limit，hasMore 为 true")
    }
  } else if (total !== null && total <= limit) {
    if (nextCursor !== null) {
      issues.push("❌ total <= limit，但 nextCursor 不为 null")
    } else {
      successes.push("✅ total <= limit，nextCursor 为 null")
    }

    if (hasMore) {
      issues.push("❌ total <= limit，但 hasMore 为 true")
    } else {
      successes.push("✅ total <= limit，hasMore 为 false")
    }
  }

  // 验证 3: hasMore 与 nextCursor 一致性
  if (hasMore && !nextCursor) {
    issues.push("❌ hasMore 为 true，但 nextCursor 为 null（不一致）")
  } else if (!hasMore && nextCursor) {
    issues.push("❌ hasMore 为 false，但 nextCursor 不为 null（不一致）")
  } else {
    successes.push("✅ hasMore 与 nextCursor 保持一致")
  }

  // 如果没有更多数据，验证结束
  if (!hasMore || !nextCursor) {
    console.log("\n📊 验证结果:")
    console.log(`  总数据量: ${total}`)
    console.log(`  单页数据: ${firstResponse.data.length}`)
    console.log(`  无需分页，验证完成`)
    printResults(successes, issues)
    return
  }

  // 第二步：第二页请求（应使用 cursor，不应包含 includeTotal）
  console.log("\n【步骤 2】第二页请求验证")
  const secondResponse = await fetchFollowList(userId, type, {
    limit: "20",
    cursor: nextCursor,
  })

  console.log(`✓ 响应状态: ${secondResponse.success ? "成功" : "失败"}`)
  console.log(`✓ 数据条数: ${secondResponse.data.length}`)
  console.log(`✓ 分页信息:`, JSON.stringify(secondResponse.meta.pagination, null, 2))

  // 验证 4: 第二页不应返回 total（因为没有传 includeTotal）
  if (secondResponse.meta.pagination.total !== null) {
    issues.push("❌ 第二页请求未传 includeTotal，但 total 不为 null")
  } else {
    successes.push("✅ 第二页请求未传 includeTotal，total 为 null（避免了 COUNT(*)）")
  }

  // 验证 5: 第二页的 hasMore 和 nextCursor 一致性
  const secondHasMore = secondResponse.meta.pagination.hasMore
  const secondNextCursor = secondResponse.meta.pagination.nextCursor

  if (secondHasMore && !secondNextCursor) {
    issues.push("❌ 第二页 hasMore 为 true，但 nextCursor 为 null（不一致）")
  } else if (!secondHasMore && secondNextCursor) {
    issues.push("❌ 第二页 hasMore 为 false，但 nextCursor 不为 null（不一致）")
  } else {
    successes.push("✅ 第二页 hasMore 与 nextCursor 保持一致")
  }

  // 如果还有更多数据，继续请求直到最后一页
  let currentCursor = secondNextCursor
  let pageNumber = 3
  let lastPageResponse = secondResponse

  while (currentCursor) {
    console.log(`\n【步骤 ${pageNumber}】第 ${pageNumber} 页请求验证`)
    const pageResponse = await fetchFollowList(userId, type, {
      limit: "20",
      cursor: currentCursor,
    })

    console.log(`✓ 响应状态: ${pageResponse.success ? "成功" : "失败"}`)
    console.log(`✓ 数据条数: ${pageResponse.data.length}`)
    console.log(`✓ 分页信息:`, JSON.stringify(pageResponse.meta.pagination, null, 2))

    // 验证一致性
    if (pageResponse.meta.pagination.hasMore && !pageResponse.meta.pagination.nextCursor) {
      issues.push(`❌ 第 ${pageNumber} 页 hasMore 为 true，但 nextCursor 为 null（不一致）`)
    } else if (!pageResponse.meta.pagination.hasMore && pageResponse.meta.pagination.nextCursor) {
      issues.push(`❌ 第 ${pageNumber} 页 hasMore 为 false，但 nextCursor 不为 null（不一致）`)
    } else {
      successes.push(`✅ 第 ${pageNumber} 页 hasMore 与 nextCursor 保持一致`)
    }

    currentCursor = pageResponse.meta.pagination.nextCursor
    lastPageResponse = pageResponse
    pageNumber++

    // 防止无限循环
    if (pageNumber > 10) {
      issues.push("❌ 请求超过 10 页，可能存在无限循环问题")
      break
    }
  }

  // 验证 6: 最后一页应该 nextCursor 为 null，hasMore 为 false
  console.log("\n【步骤 最终】最后一页验证")
  if (lastPageResponse.meta.pagination.nextCursor !== null) {
    issues.push("❌ 最后一页 nextCursor 不为 null")
  } else {
    successes.push("✅ 最后一页 nextCursor 为 null")
  }

  if (lastPageResponse.meta.pagination.hasMore) {
    issues.push("❌ 最后一页 hasMore 为 true")
  } else {
    successes.push("✅ 最后一页 hasMore 为 false")
  }

  // 打印结果
  console.log("\n📊 验证结果:")
  console.log(`  总数据量: ${total}`)
  console.log(`  总页数: ${pageNumber - 1}`)
  printResults(successes, issues)
}

function printResults(successes: string[], issues: string[]) {
  console.log("\n" + "=".repeat(60))
  console.log("✅ 通过的验证:")
  console.log("=".repeat(60))
  successes.forEach((s) => console.log(s))

  if (issues.length > 0) {
    console.log("\n" + "=".repeat(60))
    console.log("❌ 发现的问题:")
    console.log("=".repeat(60))
    issues.forEach((i) => console.log(i))
    console.log("\n⚠️  验证失败，请修复上述问题")
  } else {
    console.log("\n🎉 所有验证通过！分页逻辑正确。")
  }
}

async function main() {
  // 从环境变量或命令行参数获取测试用户 ID
  const testUserId = process.env.TEST_USER_ID || "testuser-id"

  console.log("🚀 开始验证关注列表分页逻辑")
  console.log(`📝 测试用户 ID: ${testUserId}`)

  try {
    // 验证粉丝列表
    await verifyPaginationLogic(testUserId, "followers")

    // 验证关注列表
    await verifyPaginationLogic(testUserId, "following")

    console.log("\n✨ 所有验证完成！")
  } catch (error) {
    console.error("\n❌ 验证过程中发生错误:", error)
    process.exit(1)
  }
}

main()
