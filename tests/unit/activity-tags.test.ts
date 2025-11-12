import { beforeEach, describe, expect, it } from "vitest"
import { extractActivityHashtags, syncActivityTags } from "@/lib/services/activity-tags"

interface TagRecord {
  id: string
  name: string
  slug: string
}

interface ActivityTagRecord {
  activityId: string
  tagId: string
}

interface CandidateRecord {
  id: string
  name: string
  slug: string
  occurrences: number
  lastSeenActivityId?: string | null
  lastSeenAt?: Date
}

function createFakeTransactionClient(initial?: {
  tags?: TagRecord[]
  activityTags?: ActivityTagRecord[]
}) {
  const tags = new Map<string, TagRecord>()
  const tagsBySlug = new Map<string, string>()
  const activityTags = new Map<string, Set<string>>()
  const activityTagCandidates = new Map<string, CandidateRecord>()
  let nextId = 1

  initial?.tags?.forEach((tag) => {
    tags.set(tag.id, { ...tag })
    tagsBySlug.set(tag.slug, tag.id)
    const numeric = Number.parseInt(tag.id.replace(/\D+/g, ""), 10)
    if (!Number.isNaN(numeric)) {
      nextId = Math.max(nextId, numeric + 1)
    }
  })

  initial?.activityTags?.forEach((relation) => {
    if (!activityTags.has(relation.activityId)) {
      activityTags.set(relation.activityId, new Set())
    }
    activityTags.get(relation.activityId)!.add(relation.tagId)
  })

  const tx = {
    activityTag: {
      findMany: async (args: any) => {
        const activityId: string | undefined = args?.where?.activityId
        const includeTag: boolean = Boolean(args?.include?.tag)
        if (!activityId) return []
        const set = activityTags.get(activityId)
        if (!set) return []
        return Array.from(set).map((tagId) => ({
          activityId,
          tagId,
          tag: includeTag ? { ...tags.get(tagId)! } : undefined,
        }))
      },
      deleteMany: async (args: any) => {
        const activityId: string | undefined = args?.where?.activityId
        const tagIds: string[] | undefined = args?.where?.tagId?.in
        if (!activityId) return { count: 0 }
        const set = activityTags.get(activityId)
        if (!set) return { count: 0 }
        if (Array.isArray(tagIds) && tagIds.length > 0) {
          tagIds.forEach((id) => set.delete(id))
          return { count: tagIds.length }
        }
        activityTags.delete(activityId)
        return { count: set.size }
      },
      createMany: async (args: any) => {
        const data: ActivityTagRecord[] = args?.data ?? []
        data.forEach(({ activityId, tagId }) => {
          if (!activityTags.has(activityId)) {
            activityTags.set(activityId, new Set())
          }
          activityTags.get(activityId)!.add(tagId)
        })
        return { count: data.length }
      },
    },
    tag: {
      findMany: async (args: any) => {
        const or: any[] = args?.where?.OR ?? []
        const slugSet = new Set<string>()
        const nameSet = new Set<string>()
        const directSlugIn: string[] | undefined = args?.where?.slug?.in
        const directNameIn: string[] | undefined = args?.where?.name?.in

        if (Array.isArray(directSlugIn)) {
          directSlugIn.forEach((slug) => slugSet.add(slug))
        }
        if (Array.isArray(directNameIn)) {
          directNameIn.forEach((name) => nameSet.add(name))
        }

        or.forEach((condition) => {
          if (condition?.slug?.in) {
            condition.slug.in.forEach((slug: string) => slugSet.add(slug))
          }
          if (condition?.name?.in) {
            condition.name.in.forEach((name: string) => nameSet.add(name))
          }
        })
        return Array.from(tags.values()).filter(
          (tag) => slugSet.has(tag.slug) || nameSet.has(tag.name)
        )
      },
      create: async (args: any) => {
        const id = args?.data?.id ?? `tag-${nextId++}`
        const record: TagRecord = {
          id,
          name: args?.data?.name,
          slug: args?.data?.slug,
        }
        tags.set(id, record)
        tagsBySlug.set(record.slug, id)
        return { ...record }
      },
      upsert: async (args: any) => {
        const slug: string | undefined = args?.where?.slug
        if (!slug) throw new Error("upsert requires slug")

        const existingId = tagsBySlug.get(slug)
        if (existingId) {
          return { ...tags.get(existingId)! }
        }

        const id = args?.create?.id ?? `tag-${nextId++}`
        const record: TagRecord = {
          id,
          name: args?.create?.name,
          slug,
        }
        tags.set(id, record)
        tagsBySlug.set(slug, id)
        return { ...record }
      },
    },
    activityTagCandidate: {
      upsert: async (args: any) => {
        const slug: string | undefined = args?.where?.slug
        if (!slug) throw new Error("candidate upsert requires slug")

        const existing = activityTagCandidates.get(slug)
        if (existing) {
          const increment: number = args?.update?.occurrences?.increment ?? 0
          const updated: CandidateRecord = {
            ...existing,
            name: args?.update?.name ?? existing.name,
            occurrences: existing.occurrences + increment,
            lastSeenActivityId: args?.update?.lastSeenActivityId ?? existing.lastSeenActivityId,
            lastSeenAt: args?.update?.lastSeenAt ?? existing.lastSeenAt,
          }
          activityTagCandidates.set(slug, updated)
          return { ...updated }
        }

        const record: CandidateRecord = {
          id: args?.create?.id ?? `candidate-${slug}`,
          name: args?.create?.name,
          slug,
          occurrences: args?.create?.occurrences ?? 1,
          lastSeenActivityId: args?.create?.lastSeenActivityId ?? null,
          lastSeenAt: args?.create?.lastSeenAt ?? new Date(),
        }
        activityTagCandidates.set(slug, record)
        return { ...record }
      },
    },
  } as unknown as import("@/lib/generated/prisma").Prisma.TransactionClient

  const snapshot = () => ({
    tags: Array.from(tags.values()),
    activityTags: Array.from(activityTags.entries()).flatMap(([activityId, set]) =>
      Array.from(set).map((tagId) => ({ activityId, tagId }))
    ),
    activityTagCandidates: Array.from(activityTagCandidates.values()),
  })

  return { tx, snapshot }
}

describe("activity tag helpers", () => {
  describe("extractActivityHashtags", () => {
    it("parses unique hashtags and ignores invalid tokens", () => {
      const tags = extractActivityHashtags(
        "#React 项目发布！#React  #Next.js @mention #无效! #T(ool) #EdgeCase123"
      )
      expect(tags).toEqual(["React", "Next.js", "无效", "EdgeCase123"])
    })

    it("caps the number of returned tags", () => {
      const input = Array.from({ length: 20 }, (_, index) => `#tag${index}`).join(" ")
      const tags = extractActivityHashtags(input)
      expect(tags).toHaveLength(10)
    })
  })

  describe("syncActivityTags", () => {
    let store: ReturnType<typeof createFakeTransactionClient>

    beforeEach(() => {
      store = createFakeTransactionClient({
        tags: [
          { id: "tag-1", name: "React", slug: "react" },
          { id: "tag-2", name: "Vue", slug: "vue" },
        ],
        activityTags: [{ activityId: "act-1", tagId: "tag-2" }],
      })
    })

    it("links existing tags and records candidates for unknown hashtags", async () => {
      const result = await syncActivityTags({
        tx: store.tx,
        activityId: "act-1",
        rawTagNames: ["React", "Next.js"],
      })

      const snapshot = store.snapshot()
      expect(snapshot.tags).toHaveLength(2)
      expect(snapshot.activityTags).toEqual([{ activityId: "act-1", tagId: "tag-1" }])
      expect(snapshot.activityTagCandidates).toEqual([
        expect.objectContaining({
          slug: "next-js",
          occurrences: 1,
          lastSeenActivityId: "act-1",
        }),
      ])
      expect(result.tagIds).toEqual(["tag-1"])
    })

    it("reuses existing tags when the same slug is processed multiple times", async () => {
      await syncActivityTags({
        tx: store.tx,
        activityId: "act-2",
        rawTagNames: ["React"],
      })

      await syncActivityTags({
        tx: store.tx,
        activityId: "act-3",
        rawTagNames: ["React"],
      })

      const snapshot = store.snapshot()
      const reactTags = snapshot.activityTags.filter((record) => record.tagId === "tag-1")
      expect(reactTags).toEqual([
        { activityId: "act-2", tagId: "tag-1" },
        { activityId: "act-3", tagId: "tag-1" },
      ])
      expect(snapshot.tags).toHaveLength(2)
    })

    it("increments candidate occurrences when unknown hashtags repeat", async () => {
      await syncActivityTags({
        tx: store.tx,
        activityId: "act-extra-1",
        rawTagNames: ["Svelte"],
      })

      await syncActivityTags({
        tx: store.tx,
        activityId: "act-extra-2",
        rawTagNames: ["Svelte"],
      })

      const snapshot = store.snapshot()
      expect(snapshot.activityTagCandidates).toEqual([
        expect.objectContaining({ slug: "svelte", occurrences: 2 }),
      ])
    })

    it("removes associations that are no longer present", async () => {
      await syncActivityTags({
        tx: store.tx,
        activityId: "act-1",
        rawTagNames: ["React"],
      })

      const snapshot = store.snapshot()
      expect(snapshot.activityTags).toEqual([{ activityId: "act-1", tagId: "tag-1" }])
    })

    it("returns empty tagIds when no tags remain", async () => {
      const result = await syncActivityTags({
        tx: store.tx,
        activityId: "act-1",
        rawTagNames: [],
      })

      expect(result.tagIds).toEqual([])
      expect(store.snapshot().activityTags).toEqual([])
    })
  })
})
