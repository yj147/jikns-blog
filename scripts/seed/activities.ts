import { PrismaClient, Role, UserStatus } from "@/lib/generated/prisma"
import bcrypt from "bcrypt"
import { randomUUID } from "node:crypto"

export interface FeedSeedContext {
  adminUserId: string
  defaultUserId: string
  featuredPostId: string
}

type FeedUserSpec = {
  email: string
  name: string
  password: string
  bio: string
  avatarSeed: string
  role?: Role
  socialLinks?: Record<string, string>
}

const FEED_USER_SPECS: FeedUserSpec[] = [
  {
    email: "feed-writer@example.com",
    name: "性能写手",
    password: "feedwriter123",
    bio: "负责活动流内容与前端体验的对外播报。",
    avatarSeed: "feed-writer",
  },
  {
    email: "feed-ops@example.com",
    name: "运维观察员",
    password: "feedops123",
    bio: "盯紧上线窗口与实时指标。",
    avatarSeed: "feed-ops",
    role: Role.ADMIN,
  },
  {
    email: "feed-guest@example.com",
    name: "体验访客",
    password: "feedguest123",
    bio: "从用户角度反馈交互细节。",
    avatarSeed: "feed-guest",
  },
  {
    email: "feed-analyst@example.com",
    name: "数据分析师",
    password: "feedanalyst123",
    bio: "追踪 LCP/TTI/CLS 报告，保证统计口径一致。",
    avatarSeed: "feed-analyst",
  },
  {
    email: "feed-reader@example.com",
    name: "活动订阅者",
    password: "feedreader123",
    bio: "作为真实关注者验证 following feed。",
    avatarSeed: "feed-reader",
  },
]

const TAG_SPECS = [
  { name: "性能优化", slug: "performance", color: "#ef4444" },
  { name: "发布节奏", slug: "release", color: "#f97316" },
  { name: "用户体验", slug: "ux", color: "#14b8a6" },
  { name: "监控指标", slug: "analytics", color: "#6366f1" },
  { name: "移动端", slug: "mobile", color: "#0ea5e9" },
]

type ActivityBlueprint = {
  id: string
  authorEmail: string
  content: string
  imageUrls: string[]
  isPinned: boolean
  viewsCount: number
  createdAt: Date
  likesBy: string[]
  comments: Array<{ authorEmail: string; content: string; createdAt: Date }>
  tags: string[]
}

const ACTIVITY_BLUEPRINTS: ActivityBlueprint[] = [
  {
    id: "act-feed-lcp-cutover",
    authorEmail: "feed-ops@example.com",
    content:
      "首屏 LCP 优化灰度完成，TTI 从 2.4s 降到 1.1s，Hero streaming 进入全量排期。#LCP #Perf",
    imageUrls: ["https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200"],
    isPinned: true,
    viewsCount: 680,
    createdAt: new Date("2025-02-01T03:00:00.000Z"),
    likesBy: [
      "admin@example.com",
      "user@example.com",
      "feed-reader@example.com",
      "feed-analyst@example.com",
    ],
    comments: [
      {
        authorEmail: "feed-writer@example.com",
        content: "Skeleton 方案同步上线，预发端 TTFB 保持 65ms。",
        createdAt: new Date("2025-02-01T04:10:00.000Z"),
      },
    ],
    tags: ["performance", "analytics"],
  },
  {
    id: "act-feed-hero-skeleton",
    authorEmail: "feed-writer@example.com",
    content: "Hero skeleton + streaming SSR 联调通过，移动端 FMP 稳定在 1.8s，桌面端回落至 1.5s。",
    imageUrls: ["https://images.unsplash.com/photo-1522199755839-a2bacb67c546?w=1200"],
    isPinned: false,
    viewsCount: 520,
    createdAt: new Date("2025-02-01T06:30:00.000Z"),
    likesBy: ["feed-reader@example.com", "feed-guest@example.com", "admin@example.com"],
    comments: [
      {
        authorEmail: "feed-ops@example.com",
        content: "预发集群通过 QA，今晚 22:00 关闭回滚窗口。",
        createdAt: new Date("2025-02-01T07:10:00.000Z"),
      },
    ],
    tags: ["performance", "ux"],
  },
  {
    id: "act-feed-nightly-metrics",
    authorEmail: "feed-analyst@example.com",
    content:
      "夜间计划运行 30 次 Lighthouse，记录 LCP/CLS 走势，并将原始数据推送到 metrics 面板，方便 QA 对比。",
    imageUrls: [],
    isPinned: false,
    viewsCount: 410,
    createdAt: new Date("2025-02-02T02:00:00.000Z"),
    likesBy: ["feed-writer@example.com", "feed-ops@example.com"],
    comments: [
      {
        authorEmail: "user@example.com",
        content: "需要把 JS 覆盖率纳入同一张图吗？",
        createdAt: new Date("2025-02-02T02:40:00.000Z"),
      },
    ],
    tags: ["analytics"],
  },
  {
    id: "act-feed-mobile-rollback",
    authorEmail: "feed-ops@example.com",
    content: "移动端夜间出现 FPS 抖动，已对 3% 用户降级动画并监控回升曲线，必要时触发灰度回滚。",
    imageUrls: ["https://images.unsplash.com/photo-1489515217757-5fd1be406fef?w=1200"],
    isPinned: false,
    viewsCount: 360,
    createdAt: new Date("2025-02-02T15:00:00.000Z"),
    likesBy: ["feed-reader@example.com", "feed-guest@example.com"],
    comments: [
      {
        authorEmail: "feed-analyst@example.com",
        content: "已在 Grafana 追加设备 SKU 维度，方便定位。",
        createdAt: new Date("2025-02-02T15:45:00.000Z"),
      },
    ],
    tags: ["mobile", "performance"],
  },
  {
    id: "act-feed-ux-feedback",
    authorEmail: "feed-guest@example.com",
    content:
      "Feedback sliding panel 的加载时序太靠后，建议评论骨架与活动卡片并行预取，避免空白闪烁。",
    imageUrls: [],
    isPinned: false,
    viewsCount: 240,
    createdAt: new Date("2025-02-03T04:45:00.000Z"),
    likesBy: ["feed-writer@example.com", "user@example.com"],
    comments: [
      {
        authorEmail: "feed-reader@example.com",
        content: "支持，把评论骨架提前展示。",
        createdAt: new Date("2025-02-03T05:00:00.000Z"),
      },
    ],
    tags: ["ux"],
  },
  {
    id: "act-feed-admin-digest",
    authorEmail: "admin@example.com",
    content:
      "Admin 面板已切回真实数据，活动、评论、举报均来自 feed 场景，可直接截图用于 Phase1 汇报。",
    imageUrls: [],
    isPinned: false,
    viewsCount: 300,
    createdAt: new Date("2025-02-04T01:15:00.000Z"),
    likesBy: ["feed-ops@example.com", "feed-analyst@example.com", "feed-writer@example.com"],
    comments: [
      {
        authorEmail: "feed-guest@example.com",
        content: "已在 QA 复测通过。",
        createdAt: new Date("2025-02-04T01:40:00.000Z"),
      },
    ],
    tags: ["release", "analytics"],
  },
]

const FOLLOW_RELATIONS = [
  { follower: "feed-reader@example.com", following: "feed-writer@example.com" },
  { follower: "feed-reader@example.com", following: "feed-ops@example.com" },
  { follower: "feed-reader@example.com", following: "feed-analyst@example.com" },
  { follower: "user@example.com", following: "feed-ops@example.com" },
  { follower: "feed-guest@example.com", following: "feed-writer@example.com" },
]

export async function seedFeedScenario(prisma: PrismaClient, context: FeedSeedContext) {
  console.log("\n🚀 构建 feed 场景基线数据...")

  const adminUser = await prisma.user.findUniqueOrThrow({ where: { id: context.adminUserId } })
  const defaultUser = await prisma.user.findUniqueOrThrow({ where: { id: context.defaultUserId } })

  const userMap = new Map<string, typeof adminUser>()
  userMap.set(adminUser.email.toLowerCase(), adminUser)
  userMap.set(defaultUser.email.toLowerCase(), defaultUser)

  for (const spec of FEED_USER_SPECS) {
    const passwordHash = await bcrypt.hash(spec.password, 10)
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: spec.email,
        name: spec.name,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${spec.avatarSeed}`,
        bio: spec.bio,
        socialLinks: spec.socialLinks,
        role: spec.role ?? Role.USER,
        status: UserStatus.ACTIVE,
        passwordHash,
        lastLoginAt: new Date("2025-01-28T00:00:00.000Z"),
        updatedAt: new Date("2025-01-28T00:00:00.000Z"),
      },
    })

    userMap.set(spec.email.toLowerCase(), user)
  }

  const tagMap = new Map<string, { id: string }>()
  for (const tag of TAG_SPECS) {
    const record = await prisma.tag.create({
      data: {
        id: randomUUID(),
        name: tag.name,
        slug: tag.slug,
        description: tag.name,
        color: tag.color,
        postsCount: 0,
        activitiesCount: 0,
        updatedAt: new Date("2025-02-01T00:00:00.000Z"),
      },
    })
    tagMap.set(tag.slug, record)
  }

  await prisma.follow.createMany({
    data: FOLLOW_RELATIONS.map((pair) => ({
      followerId: userMap.get(pair.follower.toLowerCase())?.id ?? defaultUser.id,
      followingId: userMap.get(pair.following.toLowerCase())?.id ?? adminUser.id,
    })),
    skipDuplicates: true,
  })

  await prisma.comment.create({
    data: {
      id: randomUUID(),
      content: "Feed 场景评论：欢迎页文案已对齐活动播报。",
      authorId: userMap.get("feed-analyst@example.com")?.id ?? defaultUser.id,
      postId: context.featuredPostId,
      createdAt: new Date("2025-02-01T08:00:00.000Z"),
      updatedAt: new Date("2025-02-01T08:00:00.000Z"),
    },
  })

  let activityCount = 0
  let likeCount = 0
  let commentCount = 1

  for (const blueprint of ACTIVITY_BLUEPRINTS) {
    const author = userMap.get(blueprint.authorEmail.toLowerCase())
    if (!author) continue

    await prisma.$transaction(async (tx) => {
      const activity = await tx.activity.create({
        data: {
          id: blueprint.id,
          authorId: author.id,
          content: blueprint.content,
          imageUrls: blueprint.imageUrls,
          isPinned: blueprint.isPinned,
          createdAt: blueprint.createdAt,
          updatedAt: blueprint.createdAt,
          viewsCount: blueprint.viewsCount,
          likesCount: blueprint.likesBy.length,
          commentsCount: blueprint.comments.length,
        },
      })

      for (const slug of blueprint.tags) {
        const tag = tagMap.get(slug)
        if (!tag) continue
        await tx.activityTag.create({
          data: {
            activityId: activity.id,
            tagId: tag.id,
          },
        })
        await tx.tag.update({
          where: { id: tag.id },
          data: { activitiesCount: { increment: 1 } },
        })
      }

      for (const likerEmail of blueprint.likesBy) {
        const liker = userMap.get(likerEmail.toLowerCase())
        if (!liker) continue
        await tx.like.create({
          data: {
            id: randomUUID(),
            authorId: liker.id,
            activityId: activity.id,
            createdAt: blueprint.createdAt,
          },
        })
      }

      for (const comment of blueprint.comments) {
        const commenter = userMap.get(comment.authorEmail.toLowerCase())
        if (!commenter) continue
        await tx.comment.create({
          data: {
            id: randomUUID(),
            content: comment.content,
            authorId: commenter.id,
            activityId: activity.id,
            createdAt: comment.createdAt,
            updatedAt: comment.createdAt,
          },
        })
      }
    })

    likeCount += blueprint.likesBy.length
    commentCount += blueprint.comments.length
    activityCount += 1
  }

  console.log("\n📈 feed 场景统计：")
  console.log(`  - 新增用户: ${FEED_USER_SPECS.length} 个`)
  console.log(`  - 新增标签: ${TAG_SPECS.length} 个`)
  console.log(
    `  - 动态: ${activityCount} 条 (含置顶 ${ACTIVITY_BLUEPRINTS.filter((a) => a.isPinned).length} 条)`
  )
  console.log(`  - 互动: ${likeCount} 个点赞 / ${commentCount} 条评论`)
  console.log("  - Following 覆盖: feed-reader + user@example.com 已绑定真实关注关系")
  console.log("✅ feed 场景数据就绪，可运行 pnpm build && pnpm start + Playwright 验证活动流")
}
