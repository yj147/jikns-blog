/**
 * 用户空间补全功能数据播种脚本
 *
 * 生成测试数据：
 * - 用户（含不同通知偏好和隐私设置）
 * - 通知（四种类型：LIKE, COMMENT, FOLLOW, SYSTEM）
 * - 关联的帖子和评论
 */

import { PrismaClient, NotificationType } from "@/lib/generated/prisma"

const prisma = new PrismaClient()

const USERS_DATA = [
  {
    email: "alice@example.com",
    name: "Alice Chen",
    bio: "全栈开发者，热爱技术分享",
    location: "北京",
    phone: "+86 138 0000 0001",
    notificationPreferences: {}, // 全部启用（默认）
    privacySettings: {
      showEmail: true,
      showActivities: true,
    },
  },
  {
    email: "bob@example.com",
    name: "Bob Wang",
    bio: "前端工程师",
    location: "上海",
    phone: "+86 138 0000 0002",
    notificationPreferences: {
      LIKE: false, // 关闭点赞通知
      COMMENT: true,
      FOLLOW: true,
      SYSTEM: true,
    },
    privacySettings: {
      showEmail: false, // 隐藏邮箱
      showActivities: true,
    },
  },
  {
    email: "charlie@example.com",
    name: "Charlie Li",
    bio: "后端架构师",
    location: "深圳",
    notificationPreferences: {
      LIKE: true,
      COMMENT: true,
      FOLLOW: false, // 关闭关注通知
      SYSTEM: true,
    },
    privacySettings: {
      showEmail: true,
      showActivities: false, // 隐藏动态
    },
  },
  {
    email: "diana@example.com",
    name: "Diana Zhang",
    bio: "产品经理",
    location: "杭州",
    phone: "+86 138 0000 0004",
    notificationPreferences: {
      LIKE: false,
      COMMENT: false,
      FOLLOW: true, // 只接收关注通知
      SYSTEM: true,
    },
    privacySettings: {},
  },
  {
    email: "eve@example.com",
    name: "Eve Liu",
    bio: "UI/UX 设计师",
    notificationPreferences: {
      LIKE: true,
      COMMENT: false,
      FOLLOW: false,
      SYSTEM: true, // 只接收点赞和系统通知
    },
    privacySettings: {
      showEmail: false,
      showActivities: false,
    },
  },
]

async function clearExistingData() {
  console.log("🗑️  清理现有测试数据...")

  await prisma.notification.deleteMany({
    where: {
      recipient: {
        email: {
          in: USERS_DATA.map((u) => u.email),
        },
      },
    },
  })

  await prisma.comment.deleteMany({
    where: {
      author: {
        email: {
          in: USERS_DATA.map((u) => u.email),
        },
      },
    },
  })

  await prisma.post.deleteMany({
    where: {
      author: {
        email: {
          in: USERS_DATA.map((u) => u.email),
        },
      },
    },
  })

  await prisma.activity.deleteMany({
    where: {
      author: {
        email: {
          in: USERS_DATA.map((u) => u.email),
        },
      },
    },
  })

  await prisma.user.deleteMany({
    where: {
      email: {
        in: USERS_DATA.map((u) => u.email),
      },
    },
  })

  console.log("✅ 清理完成")
}

async function seedUsers() {
  console.log("👥 创建用户...")

  const users = []
  for (const userData of USERS_DATA) {
    const user = await prisma.user.create({
      data: {
        ...userData,
        notificationPreferences: userData.notificationPreferences,
        privacySettings: userData.privacySettings,
      },
    })
    users.push(user)
    console.log(`  ✓ ${user.name} (${user.email})`)
  }

  return users
}

async function seedPostsAndActivities(users: any[]) {
  console.log("📝 创建帖子和动态...")

  const posts = []
  const activities = []

  // 为每个用户创建1-2个帖子
  for (let i = 0; i < users.length; i++) {
    const user = users[i]

    // 帖子
    const post = await prisma.post.create({
      data: {
        title: `${user.name}的技术分享 #${i + 1}`,
        slug: `tech-share-${user.id}-${i + 1}`,
        content: `这是${user.name}分享的技术内容...`,
        excerpt: `${user.name}的精彩技术分享`,
        published: true,
        authorId: user.id,
        publishedAt: new Date(Date.now() - i * 86400000), // 错开发布时间
      },
    })
    posts.push(post)

    // 动态
    const activity = await prisma.activity.create({
      data: {
        content: `${user.name}发布了一条新动态！`,
        authorId: user.id,
        createdAt: new Date(Date.now() - i * 43200000), // 错开创建时间
      },
    })
    activities.push(activity)
  }

  console.log(`  ✓ 创建了 ${posts.length} 个帖子和 ${activities.length} 条动态`)
  return { posts, activities }
}

async function seedNotifications(
  users: any[],
  posts: any[],
  activities: any[]
) {
  console.log("🔔 创建通知...")

  const notifications = []
  const now = Date.now()

  // LIKE 通知（点赞帖子）
  for (let i = 0; i < 5; i++) {
    const recipient = users[i % users.length]
    const actor = users[(i + 1) % users.length]
    const post = posts[i % posts.length]

    const notification = await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        actorId: actor.id,
        type: NotificationType.LIKE,
        postId: post.id,
        createdAt: new Date(now - i * 3600000), // 错开1小时
        readAt: i % 3 === 0 ? new Date(now - i * 1800000) : null, // 部分已读
      },
    })
    notifications.push(notification)
  }

  // COMMENT 通知（评论帖子）
  for (let i = 0; i < 5; i++) {
    const recipient = users[i % users.length]
    const actor = users[(i + 2) % users.length]
    const post = posts[i % posts.length]

    // 创建评论
    const comment = await prisma.comment.create({
      data: {
        content: `来自 ${actor.name} 的评论`,
        authorId: actor.id,
        postId: post.id,
      },
    })

    const notification = await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        actorId: actor.id,
        type: NotificationType.COMMENT,
        postId: post.id,
        commentId: comment.id,
        createdAt: new Date(now - (i + 5) * 3600000),
        readAt: i % 2 === 0 ? new Date(now - (i + 5) * 1800000) : null,
      },
    })
    notifications.push(notification)
  }

  // FOLLOW 通知
  for (let i = 0; i < 5; i++) {
    const recipient = users[i % users.length]
    const actor = users[(i + 3) % users.length]

    const notification = await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        actorId: actor.id,
        type: NotificationType.FOLLOW,
        createdAt: new Date(now - (i + 10) * 3600000),
        readAt: i % 4 === 0 ? new Date(now - (i + 10) * 1800000) : null,
      },
    })
    notifications.push(notification)
  }

  // SYSTEM 通知
  for (let i = 0; i < 5; i++) {
    const recipient = users[i % users.length]
    const actor = users[0] // 系统消息使用第一个用户作为 actor

    const notification = await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        actorId: actor.id,
        type: NotificationType.SYSTEM,
        createdAt: new Date(now - (i + 15) * 3600000),
        readAt: i % 5 === 0 ? new Date(now - (i + 15) * 1800000) : null,
      },
    })
    notifications.push(notification)
  }

  console.log(`  ✓ 创建了 ${notifications.length} 条通知`)

  // 统计
  const stats = {
    total: notifications.length,
    read: notifications.filter((n) => n.readAt !== null).length,
    unread: notifications.filter((n) => n.readAt === null).length,
    byType: {
      LIKE: notifications.filter((n) => n.type === NotificationType.LIKE)
        .length,
      COMMENT: notifications.filter((n) => n.type === NotificationType.COMMENT)
        .length,
      FOLLOW: notifications.filter((n) => n.type === NotificationType.FOLLOW)
        .length,
      SYSTEM: notifications.filter((n) => n.type === NotificationType.SYSTEM)
        .length,
    },
  }

  console.log("  📊 通知统计：")
  console.log(`    - 总数: ${stats.total}`)
  console.log(`    - 已读: ${stats.read}`)
  console.log(`    - 未读: ${stats.unread}`)
  console.log(
    `    - LIKE: ${stats.byType.LIKE}, COMMENT: ${stats.byType.COMMENT}, FOLLOW: ${stats.byType.FOLLOW}, SYSTEM: ${stats.byType.SYSTEM}`
  )

  return notifications
}

async function main() {
  console.log("🌱 开始播种用户空间数据...\n")

  try {
    // 清理现有数据
    await clearExistingData()

    // 创建用户
    const users = await seedUsers()

    // 创建帖子和动态
    const { posts, activities } = await seedPostsAndActivities(users)

    // 创建通知
    await seedNotifications(users, posts, activities)

    console.log("\n✅ 播种完成！")
    console.log("\n📝 用户列表（可用于登录测试）：")
    users.forEach((user) => {
      console.log(`  - ${user.email} (${user.name})`)
    })
  } catch (error) {
    console.error("❌ 播种失败：", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
