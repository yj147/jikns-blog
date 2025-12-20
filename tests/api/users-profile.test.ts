import { randomUUID } from "node:crypto"
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import type { Role, UserStatus } from "@/lib/generated/prisma"
import { realPrisma } from "../integration/setup-real-db"

vi.doUnmock("@/lib/prisma")
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

type Tracker = {
  userIds: Set<string>
  tagIds: Set<string>
  postIds: Set<string>
  activityIds: Set<string>
  postTagLinks: Set<string>
  activityTagLinks: Set<string>
  commentIds: Set<string>
  likeIds: Set<string>
  followPairs: Set<string>
}

const COMPOSITE_SEPARATOR = "::"

const BASE_URL = "http://localhost:3000"

const buildRequest = (path: string) => new NextRequest(`${BASE_URL}${path}`)

const createTracker = (): Tracker => ({
  userIds: new Set(),
  tagIds: new Set(),
  postIds: new Set(),
  activityIds: new Set(),
  postTagLinks: new Set(),
  activityTagLinks: new Set(),
  commentIds: new Set(),
  likeIds: new Set(),
  followPairs: new Set(),
})

const ids = (collection: Set<string>) => Array.from(collection)

async function cleanupTracker(tracker?: Tracker) {
  if (!tracker) return

  await Promise.all(
    Array.from(tracker.postTagLinks).map((link) => {
      const [postId, tagId] = link.split(COMPOSITE_SEPARATOR)
      return realPrisma.postTag.deleteMany({ where: { postId, tagId } })
    })
  )

  await Promise.all(
    Array.from(tracker.activityTagLinks).map((link) => {
      const [activityId, tagId] = link.split(COMPOSITE_SEPARATOR)
      return realPrisma.activityTag.deleteMany({ where: { activityId, tagId } })
    })
  )

  if (tracker.commentIds.size) {
    await realPrisma.comment.deleteMany({ where: { id: { in: ids(tracker.commentIds) } } })
  }

  if (tracker.likeIds.size) {
    await realPrisma.like.deleteMany({ where: { id: { in: ids(tracker.likeIds) } } })
  }

  for (const pair of tracker.followPairs) {
    const [followerId, followingId] = pair.split(COMPOSITE_SEPARATOR)
    await realPrisma.follow.deleteMany({ where: { followerId, followingId } })
  }

  if (tracker.activityIds.size) {
    await realPrisma.activity.deleteMany({ where: { id: { in: ids(tracker.activityIds) } } })
  }

  if (tracker.postIds.size) {
    await realPrisma.post.deleteMany({ where: { id: { in: ids(tracker.postIds) } } })
  }

  if (tracker.tagIds.size) {
    await realPrisma.tag.deleteMany({ where: { id: { in: ids(tracker.tagIds) } } })
  }

  if (tracker.userIds.size) {
    await realPrisma.user.deleteMany({ where: { id: { in: ids(tracker.userIds) } } })
  }
}

async function createUser(
  tracker: Tracker,
  overrides: Partial<{
    id: string
    email: string
    name: string
    role: Role
    status: UserStatus
  }> = {}
) {
  const user = await realPrisma.user.create({
    data: {
      id: overrides.id ?? randomUUID(),
      email: overrides.email ?? `profile-user-${randomUUID()}@example.com`,
      name: overrides.name ?? "Profile User",
      role: overrides.role ?? "USER",
      status: overrides.status ?? "ACTIVE",
      avatarUrl: null,
    },
  })
  tracker.userIds.add(user.id)
  return user
}

async function createTag(
  tracker: Tracker,
  overrides: Partial<{ id: string; name: string; slug: string }> = {}
) {
  const tag = await realPrisma.tag.create({
    data: {
      id: overrides.id ?? randomUUID(),
      name: overrides.name ?? `Tag-${randomUUID().slice(0, 6)}`,
      slug: overrides.slug ?? `tag-${randomUUID()}`,
    },
  })
  tracker.tagIds.add(tag.id)
  return tag
}

async function createPost(
  tracker: Tracker,
  data: {
    authorId: string
    title?: string
    slug?: string
    content?: string
    excerpt?: string
    published?: boolean
    publishedAt?: Date | null
    createdAt?: Date
    viewCount?: number
  }
) {
  const createdAt = data.createdAt ?? new Date()
  const published = typeof data.published === "boolean" ? data.published : true
  const publishedAt = published === false ? null : (data.publishedAt ?? createdAt)

  const post = await realPrisma.post.create({
    data: {
      id: randomUUID(),
      authorId: data.authorId,
      title: data.title ?? "Test Post",
      slug: data.slug ?? `post-${randomUUID()}`,
      content: data.content ?? "Test content",
      excerpt: data.excerpt ?? "Test excerpt",
      createdAt,
      published,
      publishedAt,
      viewCount: data.viewCount ?? 0,
    },
  })
  tracker.postIds.add(post.id)
  return post
}

async function softDeletePost(postId: string) {
  await realPrisma.post.update({
    where: { id: postId },
    data: {
      published: false,
      publishedAt: null,
    },
  })
}

async function linkTagToPost(tracker: Tracker, postId: string, tagId: string) {
  await realPrisma.postTag.create({
    data: {
      postId,
      tagId,
    },
  })
  tracker.postTagLinks.add(`${postId}${COMPOSITE_SEPARATOR}${tagId}`)
}

async function createActivity(
  tracker: Tracker,
  data: {
    authorId: string
    content?: string
    imageUrls?: string[]
    createdAt?: Date
    isPinned?: boolean
  }
) {
  const activity = await realPrisma.activity.create({
    data: {
      id: randomUUID(),
      authorId: data.authorId,
      content: data.content ?? "Test activity",
      imageUrls: data.imageUrls ?? [],
      createdAt: data.createdAt ?? new Date(),
      isPinned: data.isPinned ?? false,
    },
  })
  tracker.activityIds.add(activity.id)
  return activity
}

async function softDeleteActivity(activityId: string) {
  await realPrisma.activity.update({
    where: { id: activityId },
    data: { deletedAt: new Date() },
  })
}

async function linkTagToActivity(tracker: Tracker, activityId: string, tagId: string) {
  await realPrisma.activityTag.create({
    data: {
      activityId,
      tagId,
    },
  })
  tracker.activityTagLinks.add(`${activityId}${COMPOSITE_SEPARATOR}${tagId}`)
}

async function createActivityComment(
  tracker: Tracker,
  data: { authorId: string; activityId: string; content?: string }
) {
  const comment = await realPrisma.comment.create({
    data: {
      id: randomUUID(),
      authorId: data.authorId,
      activityId: data.activityId,
      content: data.content ?? "Test comment",
    },
  })
  tracker.commentIds.add(comment.id)
  return comment
}

async function createActivityLike(
  tracker: Tracker,
  data: { authorId: string; activityId: string }
) {
  const like = await realPrisma.like.create({
    data: {
      id: randomUUID(),
      authorId: data.authorId,
      activityId: data.activityId,
    },
  })
  tracker.likeIds.add(like.id)
  return like
}

async function createFollow(tracker: Tracker, followerId: string, followingId: string) {
  await realPrisma.follow.create({
    data: { followerId, followingId },
  })
  tracker.followPairs.add(`${followerId}${COMPOSITE_SEPARATOR}${followingId}`)
}

describe("Profile API integration", () => {
  let postsHandler: typeof import("@/app/api/users/[userId]/posts/route").GET
  let activitiesHandler: typeof import("@/app/api/users/[userId]/activities/route").GET
  let statsHandler: typeof import("@/app/api/users/[userId]/stats/route").GET

  beforeAll(async () => {
    postsHandler = (await import("@/app/api/users/[userId]/posts/route")).GET
    activitiesHandler = (await import("@/app/api/users/[userId]/activities/route")).GET
    statsHandler = (await import("@/app/api/users/[userId]/stats/route")).GET
  })

  afterAll(async () => {
    await realPrisma.$disconnect()
  })

  describe("GET /api/users/[userId]/posts", () => {
    let tracker: Tracker | undefined

    beforeEach(() => {
      tracker = createTracker()
    })

    afterEach(async () => {
      await cleanupTracker(tracker)
      tracker = undefined
    })

    it("returns paginated published posts with metrics while filtering drafts and deleted entries", async () => {
      if (!tracker) throw new Error("tracker not initialized")
      const author = await createUser(tracker, { name: "Profile Author" })
      const primaryTag = await createTag(tracker, {
        name: "Performance",
        slug: `perf-${randomUUID()}`,
      })
      const secondaryTag = await createTag(tracker, { name: "SEO", slug: `seo-${randomUUID()}` })

      const longContent = Array.from({ length: 600 }, () => "reading").join(" ")

      const newest = await createPost(tracker, {
        authorId: author.id,
        title: "Newest",
        slug: `newest-${randomUUID()}`,
        content: longContent,
        publishedAt: new Date("2024-05-06T10:00:00.000Z"),
        createdAt: new Date("2024-05-06T09:00:00.000Z"),
        viewCount: 42,
      })
      await linkTagToPost(tracker, newest.id, primaryTag.id)
      await linkTagToPost(tracker, newest.id, secondaryTag.id)

      const middle = await createPost(tracker, {
        authorId: author.id,
        title: "Middle",
        slug: `middle-${randomUUID()}`,
        content: longContent,
        publishedAt: new Date("2024-05-05T08:00:00.000Z"),
        createdAt: new Date("2024-05-05T07:00:00.000Z"),
        viewCount: 7,
      })
      await linkTagToPost(tracker, middle.id, primaryTag.id)

      await createPost(tracker, {
        authorId: author.id,
        title: "Older",
        slug: `older-${randomUUID()}`,
        content: "short content",
        publishedAt: new Date("2024-05-04T08:00:00.000Z"),
        createdAt: new Date("2024-05-04T07:00:00.000Z"),
        viewCount: 3,
      })

      const draft = await createPost(tracker, {
        authorId: author.id,
        title: "Draft",
        slug: `draft-${randomUUID()}`,
        published: false,
        publishedAt: null,
      })

      const deleted = await createPost(tracker, {
        authorId: author.id,
        title: "Deleted",
        slug: `deleted-${randomUUID()}`,
        publishedAt: new Date("2024-05-03T08:00:00.000Z"),
      })
      await softDeletePost(deleted.id)

      const response = await postsHandler(
        buildRequest(`/api/users/${author.id}/posts?page=1&limit=2`),
        { params: Promise.resolve({ userId: author.id }) }
      )

      expect(response.status).toBe(200)
      const payload = await response.json()

      expect(payload.success).toBe(true)
      expect(payload.pagination).toMatchObject({ page: 1, limit: 2, total: 3, hasMore: true })

      const returnedIds = payload.data.map((item: any) => item.id)
      expect(returnedIds).toEqual([newest.id, middle.id])
      expect(returnedIds).not.toContain(draft.id)
      expect(returnedIds).not.toContain(deleted.id)

      const head = payload.data[0]
      expect(head.viewCount).toBe(42)
      expect(head.readTimeMinutes).toBe(2)
      expect(head.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: primaryTag.id, slug: primaryTag.slug }),
          expect.objectContaining({ id: secondaryTag.id, slug: secondaryTag.slug }),
        ])
      )
      expect(head._count).toEqual(expect.objectContaining({ comments: 0, likes: 0 }))

      const firstPublishedAt = new Date(head.publishedAt).getTime()
      const secondPublishedAt = new Date(payload.data[1].publishedAt).getTime()
      expect(firstPublishedAt).toBeGreaterThan(secondPublishedAt)
    })

    it("returns an empty list when the user does not exist", async () => {
      const ghostUserId = randomUUID()
      const response = await postsHandler(
        buildRequest(`/api/users/${ghostUserId}/posts?page=2&limit=5`),
        { params: Promise.resolve({ userId: ghostUserId }) }
      )

      expect(response.status).toBe(200)
      const payload = await response.json()

      expect(payload.data).toEqual([])
      expect(payload.pagination).toMatchObject({ page: 2, limit: 5, total: 0, hasMore: false })
    })
  })

  describe("GET /api/users/[userId]/activities", () => {
    let tracker: Tracker | undefined

    beforeEach(() => {
      tracker = createTracker()
    })

    afterEach(async () => {
      await cleanupTracker(tracker)
      tracker = undefined
    })

    it("returns activity items with author metadata, tags, counts and filters deleted rows", async () => {
      if (!tracker) throw new Error("tracker not initialized")
      const author = await createUser(tracker, { name: "Activity Author" })
      const commenter = await createUser(tracker, { name: "Activity Commenter" })
      const tag = await createTag(tracker, { name: "Daily" })

      const newest = await createActivity(tracker, {
        authorId: author.id,
        content: "Latest activity",
        imageUrls: ["https://img.example.com/latest.png"],
        createdAt: new Date("2024-05-06T08:00:00.000Z"),
      })
      await linkTagToActivity(tracker, newest.id, tag.id)
      await createActivityComment(tracker, {
        authorId: commenter.id,
        activityId: newest.id,
        content: "Nice!",
      })
      await createActivityLike(tracker, { authorId: commenter.id, activityId: newest.id })

      await createActivity(tracker, {
        authorId: author.id,
        content: "Middle activity",
        createdAt: new Date("2024-05-05T08:00:00.000Z"),
      })
      await createActivity(tracker, {
        authorId: author.id,
        content: "Oldest activity",
        createdAt: new Date("2024-05-04T08:00:00.000Z"),
      })

      const deleted = await createActivity(tracker, {
        authorId: author.id,
        content: "Should be filtered",
        createdAt: new Date("2024-05-03T08:00:00.000Z"),
      })
      await softDeleteActivity(deleted.id)

      const response = await activitiesHandler(
        buildRequest(`/api/users/${author.id}/activities?page=1&limit=1`),
        { params: Promise.resolve({ userId: author.id }) }
      )

      expect(response.status).toBe(200)
      const payload = await response.json()

      expect(payload.success).toBe(true)
      expect(payload.pagination).toMatchObject({ page: 1, limit: 1, total: 3, hasMore: true })
      expect(payload.data).toHaveLength(1)

      const [activity] = payload.data
      expect(activity.id).toBe(newest.id)
      expect(activity.author).toEqual(expect.objectContaining({ id: author.id, name: author.name }))
      expect(activity.tags).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: tag.id })])
      )
      expect(activity._count).toEqual(expect.objectContaining({ comments: 1, likes: 1 }))
      expect(activity.id).not.toBe(deleted.id)
    })
  })

  describe("GET /api/users/[userId]/stats", () => {
    let tracker: Tracker | undefined

    beforeEach(() => {
      tracker = createTracker()
    })

    afterEach(async () => {
      await cleanupTracker(tracker)
      tracker = undefined
    })

    it("returns accurate aggregate stats for followers, following, posts and activities", async () => {
      if (!tracker) throw new Error("tracker not initialized")
      const owner = await createUser(tracker, { name: "Stats Owner" })
      const followerA = await createUser(tracker, { name: "Follower A" })
      const followerB = await createUser(tracker, { name: "Follower B" })
      const following = await createUser(tracker, { name: "Following User" })

      await createFollow(tracker, followerA.id, owner.id)
      await createFollow(tracker, followerB.id, owner.id)
      await createFollow(tracker, owner.id, following.id)

      await createPost(tracker, {
        authorId: owner.id,
        title: "Counted Post 1",
        slug: `counted-1-${randomUUID()}`,
        content: "content",
        publishedAt: new Date("2024-05-06T00:00:00.000Z"),
        viewCount: 1,
      })
      await createPost(tracker, {
        authorId: owner.id,
        title: "Counted Post 2",
        slug: `counted-2-${randomUUID()}`,
        content: "content",
        publishedAt: new Date("2024-05-05T00:00:00.000Z"),
        viewCount: 2,
      })
      await createPost(tracker, {
        authorId: owner.id,
        title: "Draft Post",
        slug: `draft-${randomUUID()}`,
        published: false,
        publishedAt: null,
      })
      const deletedPost = await createPost(tracker, {
        authorId: owner.id,
        title: "Deleted Post",
        slug: `deleted-${randomUUID()}`,
        publishedAt: new Date("2024-05-04T00:00:00.000Z"),
      })
      await softDeletePost(deletedPost.id)

      await createActivity(tracker, { authorId: owner.id, content: "Active A" })
      await createActivity(tracker, { authorId: owner.id, content: "Active B" })
      const deletedActivity = await createActivity(tracker, {
        authorId: owner.id,
        content: "Deleted",
      })
      await softDeleteActivity(deletedActivity.id)

      const response = await statsHandler(buildRequest(`/api/users/${owner.id}/stats`), {
        params: Promise.resolve({ userId: owner.id }),
      })

      expect(response.status).toBe(200)
      const payload = await response.json()

      expect(payload.success).toBe(true)
      expect(payload.data).toEqual({
        followers: 2,
        following: 1,
        posts: 2,
        activities: 2,
      })
    })

    it("returns zeroed stats for unknown users", async () => {
      const ghostUserId = randomUUID()
      const response = await statsHandler(buildRequest(`/api/users/${ghostUserId}/stats`), {
        params: Promise.resolve({ userId: ghostUserId }),
      })

      expect(response.status).toBe(200)
      const payload = await response.json()

      expect(payload.success).toBe(true)
      expect(payload.data).toEqual({
        followers: 0,
        following: 0,
        posts: 0,
        activities: 0,
      })
    })
  })
})
