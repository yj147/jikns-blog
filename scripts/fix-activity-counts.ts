/**
 * 数据迁移脚本：修复 Activity 的 likesCount 和 commentsCount 不一致
 *
 * 问题背景：
 * - 由于历史代码中 like/comment 创建和计数更新不在同一事务中
 * - 可能导致 activity.likesCount 和 activity.commentsCount 与实际记录数不一致
 *
 * 修复策略：
 * 1. 统计每个 activity 的实际 like 和 comment 数量
 * 2. 与 activity 表中的冗余计数对比
 * 3. 对不一致的记录进行修正
 *
 * 使用方法：
 * pnpm tsx scripts/fix-activity-counts.ts
 */

import { prisma } from "@/lib/prisma"

interface ActivityCountIssue {
  activityId: string
  currentLikesCount: number
  actualLikesCount: number
  currentCommentsCount: number
  actualCommentsCount: number
  hasIssue: boolean
}

async function analyzeActivityCounts(): Promise<ActivityCountIssue[]> {
  console.log("🔍 开始分析 Activity 计数一致性...\n")

  // 获取所有未删除的 activity
  const activities = await prisma.activity.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      likesCount: true,
      commentsCount: true,
    },
  })

  console.log(`📊 找到 ${activities.length} 个活动需要检查\n`)

  const issues: ActivityCountIssue[] = []

  for (const activity of activities) {
    // 统计实际的点赞数
    const actualLikesCount = await prisma.like.count({
      where: { activityId: activity.id },
    })

    // 统计实际的评论数
    const actualCommentsCount = await prisma.comment.count({
      where: { activityId: activity.id },
    })

    const hasIssue =
      activity.likesCount !== actualLikesCount || activity.commentsCount !== actualCommentsCount

    if (hasIssue) {
      issues.push({
        activityId: activity.id,
        currentLikesCount: activity.likesCount || 0,
        actualLikesCount,
        currentCommentsCount: activity.commentsCount || 0,
        actualCommentsCount,
        hasIssue: true,
      })

      console.log(`⚠️  不一致: Activity ${activity.id.slice(0, 8)}...`)
      console.log(`   点赞: ${activity.likesCount} → ${actualLikesCount}`)
      console.log(`   评论: ${activity.commentsCount} → ${actualCommentsCount}\n`)
    }
  }

  return issues
}

async function fixActivityCounts(issues: ActivityCountIssue[]): Promise<void> {
  if (issues.length === 0) {
    console.log("✅ 所有 Activity 计数都是一致的，无需修复！\n")
    return
  }

  console.log(`\n🔧 开始修复 ${issues.length} 个不一致的 Activity...\n`)

  let successCount = 0
  let failCount = 0

  for (const issue of issues) {
    try {
      await prisma.activity.update({
        where: { id: issue.activityId },
        data: {
          likesCount: issue.actualLikesCount,
          commentsCount: issue.actualCommentsCount,
        },
      })

      console.log(`✅ 修复成功: ${issue.activityId.slice(0, 8)}...`)
      successCount++
    } catch (error) {
      console.error(`❌ 修复失败: ${issue.activityId.slice(0, 8)}...`, error)
      failCount++
    }
  }

  console.log(`\n📊 修复完成统计:`)
  console.log(`   成功: ${successCount}`)
  console.log(`   失败: ${failCount}`)
}

async function verifyFix(): Promise<void> {
  console.log("\n🔍 验证修复结果...\n")

  const remainingIssues = await analyzeActivityCounts()

  if (remainingIssues.length === 0) {
    console.log("✅ 验证通过！所有计数已修复一致。\n")
  } else {
    console.log(`⚠️  仍有 ${remainingIssues.length} 个 Activity 计数不一致\n`)
    console.log("建议：检查数据库连接和权限，然后重新运行脚本\n")
  }
}

async function main() {
  console.log("=".repeat(60))
  console.log("Activity 计数一致性修复脚本")
  console.log("=".repeat(60) + "\n")

  try {
    // 第一步：分析问题
    const issues = await analyzeActivityCounts()

    // 第二步：修复问题
    await fixActivityCounts(issues)

    // 第三步：验证修复
    await verifyFix()

    console.log("=".repeat(60))
    console.log("脚本执行完成")
    console.log("=".repeat(60) + "\n")
  } catch (error) {
    console.error("❌ 脚本执行失败:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 执行主函数
main()
