import { Role, UserStatus } from "@/lib/generated/prisma"
import type { ActivityListItem, ActivityOrderBy } from "@/lib/repos/activity-repo"

type FixtureQuery = {
  name?: string | null
  limit: number
  page?: number | null
  cursor?: string | null
  hasImages?: boolean | null
  isPinned?: boolean | null
  orderBy?: ActivityOrderBy | null
}

interface FixtureResult {
  items: ActivityListItem[]
  hasMore: boolean
  nextCursor: string | null
  totalCount: number
}

type FixtureFactory = () => ActivityListItem[]

const MINUTE = 60 * 1000

const baseDemoFixture: FixtureFactory = () => {
  const baseContents = [
    {
      content: "新版图像优化链路已上线，Lighthouse 节省 12MB 资源",
      imageUrls: ["https://images.unsplash.com/photo-1508923567004-3a6b8004f3d8?w=800"],
      isPinned: true,
    },
    {
      content: "中间件快速路径完成，TTFB 降到 67ms",
    },
    {
      content: "Activity API 已恢复，Feed 正式接回真实数据",
      imageUrls: ["https://images.unsplash.com/photo-1522199710521-72d69614c702?w=800"],
    },
    {
      content: "新增 OptimizedAvatarImage，头像加载更清晰",
    },
    {
      content: "评论系统兼容层回收，统一改用 /api/comments",
    },
    {
      content: "Supabase Storage 渲染域名配置完毕",
      imageUrls: ["https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800"],
    },
    {
      content: "首屏 Hero skeleton 方案设计完成，等待 Phase1.3",
    },
    {
      content: "Lighthouse 最终版性能得分 70 → 87",
      imageUrls: ["https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800"],
    },
    {
      content: "中后台权限脚本补档，Husky pre-push 更新",
    },
    {
      content: "Feed 推荐关注接口恢复，关注列表实时刷新",
    },
    {
      content: "Framer-motion 懒加载评估中，准备 Phase2 引入",
    },
    {
      content: "全站图片统一走 Optimizer + Supabase Render API",
      imageUrls: ["https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800"],
    },
  ]

  return baseContents.map((entry, index) => buildDemoActivity(index + 1, entry))
}

const FIXTURES: Record<string, FixtureFactory> = {
  demo: baseDemoFixture,
}

function buildDemoActivity(
  sequence: number,
  overrides: Partial<ActivityListItem> & { content: string }
): ActivityListItem {
  const timestamp = new Date(Date.now() - sequence * MINUTE).toISOString()
  return {
    id: overrides.id ?? `demo-activity-${sequence}`,
    authorId: overrides.authorId ?? `demo-author-${sequence}`,
    content: overrides.content,
    imageUrls:
      overrides.imageUrls ??
      (sequence % 3 === 0 ? [`https://picsum.photos/seed/demo-${sequence}/960/540`] : []),
    isPinned: overrides.isPinned ?? sequence === 1,
    likesCount: overrides.likesCount ?? sequence * 3,
    commentsCount: overrides.commentsCount ?? Math.max(0, sequence - 4),
    viewsCount: overrides.viewsCount ?? sequence * 17,
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
    author: overrides.author ?? {
      id: `demo-author-${sequence}`,
      name: `性能小组 ${sequence}`,
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${sequence}`,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  }
}

function paginate(
  items: ActivityListItem[],
  limit: number,
  cursor?: string | null,
  page?: number | null
) {
  const safeLimit = Math.max(1, Math.min(limit, 50))
  let startIndex = 0

  if (cursor) {
    const cursorIndex = items.findIndex((item) => item.id === cursor)
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0
  } else if (page && page > 1) {
    startIndex = (page - 1) * safeLimit
  }

  const slice = items.slice(startIndex, startIndex + safeLimit)
  const hasMore = startIndex + safeLimit < items.length
  const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1].id : null

  return {
    items: slice,
    hasMore,
    nextCursor,
  }
}

export function getActivityFixture(query: FixtureQuery): FixtureResult {
  const fixtureName = query.name && FIXTURES[query.name] ? query.name : "demo"
  const factory = FIXTURES[fixtureName] ?? baseDemoFixture
  let dataset = factory()

  if (query.hasImages === true) {
    dataset = dataset.filter((item) => item.imageUrls.length > 0)
  } else if (query.hasImages === false) {
    dataset = dataset.filter((item) => item.imageUrls.length === 0)
  }

  if (query.isPinned === true) {
    dataset = dataset.filter((item) => item.isPinned)
  } else if (query.isPinned === false) {
    dataset = dataset.filter((item) => !item.isPinned)
  }

  // 简单的排序模拟
  if (query.orderBy === "trending") {
    dataset = [...dataset].sort(
      (a, b) => b.likesCount - a.likesCount || b.viewsCount - a.viewsCount
    )
  } else {
    dataset = [...dataset].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const { items, hasMore, nextCursor } = paginate(dataset, query.limit, query.cursor, query.page)

  return {
    items,
    hasMore,
    nextCursor,
    totalCount: dataset.length,
  }
}

export function shouldUseFixtureExplicitly(fixtureName?: string | null) {
  return Boolean(fixtureName && fixtureName !== "disabled")
}
