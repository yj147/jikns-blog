import { describe, expect, it, vi } from "vitest"
import type { Prisma } from "@/lib/generated/prisma"
import { syncPostTags } from "@/lib/repos/tag-repo"

interface TagRecord {
  id: string
  name: string
  slug: string
  postsCount: number
}

interface InitialState {
  tags: TagRecord[]
  postTags: Array<{ postId: string; tagId: string }>
}

function delay() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function extractTagIds(values: any[]): string[] {
  const queue: any[] = [...values]
  const result: string[] = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (typeof current === "string") {
      result.push(current)
      continue
    }
    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }
    if (current && typeof current === "object" && Array.isArray(current.values)) {
      queue.push(...current.values)
    }
  }

  return result
}

function createFakeStore(initial: InitialState) {
  const tags = new Map<string, TagRecord>()
  let nextTagId = 1

  for (const tag of initial.tags) {
    tags.set(tag.id, { ...tag })
    const numericPart = parseInt(tag.id.replace(/[^0-9]/g, ""))
    if (!Number.isNaN(numericPart)) {
      nextTagId = Math.max(nextTagId, numericPart + 1)
    }
  }

  const postTags = new Map<string, Set<string>>()
  for (const relation of initial.postTags) {
    if (!postTags.has(relation.postId)) {
      postTags.set(relation.postId, new Set())
    }
    postTags.get(relation.postId)!.add(relation.tagId)
  }

  function createTransactionClient(): Prisma.TransactionClient {
    return {
      postTag: {
        findMany: async (args: any) => {
          await delay()
          const postId = args?.where?.postId
          const includeTag = Boolean(args?.include?.tag)
          const relations = Array.from(postTags.get(postId) ?? [])
          return relations.map((tagId) => ({
            postId,
            tagId,
            tag: includeTag ? { ...tags.get(tagId)! } : undefined,
          }))
        },
        deleteMany: async (args: any) => {
          await delay()
          const postId = args?.where?.postId
          const ids: string[] = args?.where?.tagId?.in ?? []
          if (!postId) return { count: 0 }
          const set = postTags.get(postId)
          if (!set) return { count: 0 }
          ids.forEach((id) => set.delete(id))
          return { count: ids.length }
        },
        createMany: async (args: any) => {
          await delay()
          const data: Array<{ postId: string; tagId: string }> = args?.data ?? []
          for (const entry of data) {
            if (!postTags.has(entry.postId)) {
              postTags.set(entry.postId, new Set())
            }
            postTags.get(entry.postId)!.add(entry.tagId)
          }
          return { count: data.length }
        },
        count: async (args: any) => {
          await delay()
          const tagId = args?.where?.tagId
          let total = 0
          for (const set of postTags.values()) {
            if (set.has(tagId)) total += 1
          }
          return total
        },
      },
      tag: {
        findMany: async (args: any) => {
          await delay()
          const or: any[] = args?.where?.OR ?? []
          const slugSet = new Set<string>()
          const nameSet = new Set<string>()
          or.forEach((condition) => {
            if (condition?.slug?.in) {
              condition.slug.in.forEach((value: string) => slugSet.add(value))
            }
            if (condition?.name?.in) {
              condition.name.in.forEach((value: string) => nameSet.add(value))
            }
          })

          return Array.from(tags.values()).filter(
            (tag) => slugSet.has(tag.slug) || nameSet.has(tag.name)
          )
        },
        create: async (args: any) => {
          await delay()
          const id = args?.data?.id ?? `tag-${nextTagId++}`
          const record: TagRecord = {
            id,
            name: args?.data?.name,
            slug: args?.data?.slug,
            postsCount: args?.data?.postsCount ?? 0,
          }
          tags.set(id, record)
          return { ...record }
        },
        update: async (args: any) => {
          await delay()
          const id = args?.where?.id
          if (!id) throw new Error("Missing tag id")
          const existing = tags.get(id)
          if (!existing) throw new Error("Tag not found")
          if (typeof args?.data?.postsCount === "number") {
            existing.postsCount = args.data.postsCount
          }
          return { ...existing }
        },
      },
      $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
        await delay()
        const normalizedSql = strings.join(" ").replace(/\s+/g, " ").trim()
        expect(normalizedSql).toContain("FROM tags t")
        expect(normalizedSql).toContain("LEFT JOIN post_tags pt")
        expect(normalizedSql).toContain("LEFT JOIN posts p")
        expect(normalizedSql).toContain("UPDATE tags AS t")
        // 模拟 CTE SQL 批量更新标签计数
        // 实际 SQL: SELECT COUNT(*) FROM PostTag WHERE tagId = ANY(...)
        // 提取 tagIds 数组 (Prisma.join 的结果)
        const tagIds = extractTagIds(values)
        for (const tagId of tagIds) {
          const tag = tags.get(tagId)
          if (tag) {
            // 统计该标签在 postTags 中出现的次数
            let count = 0
            for (const set of postTags.values()) {
              if (set.has(tagId)) count++
            }
            tag.postsCount = Math.max(count, 0)
          }
        }
        return tagIds.length
      },
    } as unknown as Prisma.TransactionClient
  }

  function getActualCounts() {
    const counts = new Map<string, number>()
    for (const set of postTags.values()) {
      for (const tagId of set) {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
      }
    }
    return counts
  }

  return {
    createTransactionClient,
    tags,
    postTags,
    getActualCounts,
  }
}

describe("syncPostTags", () => {
  it("移除标签时应重算计数并保持非负", async () => {
    const store = createFakeStore({
      tags: [
        { id: "tag-1", name: "Tech", slug: "tech", postsCount: 2 },
        { id: "tag-2", name: "Life", slug: "life", postsCount: 1 },
      ],
      postTags: [
        { postId: "post-1", tagId: "tag-1" },
        { postId: "post-1", tagId: "tag-2" },
        { postId: "post-2", tagId: "tag-1" },
      ],
    })

    await syncPostTags({
      tx: store.createTransactionClient(),
      postId: "post-1",
      newTagNames: ["Tech"],
    })

    const tech = store.tags.get("tag-1")
    const life = store.tags.get("tag-2")

    expect(tech?.postsCount).toBe(2)
    expect(life?.postsCount).toBe(0)
    expect(life?.postsCount).toBeGreaterThanOrEqual(0)
  })

  it("并发更新同一文章标签时计数不应为负", async () => {
    const store = createFakeStore({
      tags: [
        { id: "tag-1", name: "Tech", slug: "tech", postsCount: 1 },
        { id: "tag-2", name: "Life", slug: "life", postsCount: 1 },
      ],
      postTags: [
        { postId: "post-1", tagId: "tag-1" },
        { postId: "post-1", tagId: "tag-2" },
      ],
    })

    await Promise.all([
      syncPostTags({
        tx: store.createTransactionClient(),
        postId: "post-1",
        newTagNames: ["Tech", "UI"],
      }),
      syncPostTags({
        tx: store.createTransactionClient(),
        postId: "post-1",
        newTagNames: ["Tech", "AI"],
      }),
    ])

    const actualCounts = store.getActualCounts()

    for (const tag of store.tags.values()) {
      const expected = actualCounts.get(tag.id) ?? 0
      expect(tag.postsCount).toBe(expected)
      expect(tag.postsCount).toBeGreaterThanOrEqual(0)
    }
  })
})
