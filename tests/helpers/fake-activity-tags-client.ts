import type { Prisma } from "@/lib/generated/prisma"

export interface TagRecord {
  id: string
  name: string
  slug: string
  activitiesCount: number
}

export interface ActivityTagRecord {
  activityId: string
  tagId: string
}

export interface CandidateRecord {
  id: string
  name: string
  slug: string
  occurrences: number
  lastSeenActivityId?: string | null
  lastSeenAt?: Date
}

export function createFakeTransactionClient(initial?: {
  tags?: TagRecord[]
  activityTags?: ActivityTagRecord[]
}) {
  const tags = new Map<string, TagRecord>()
  const tagsBySlug = new Map<string, string>()
  const activityTags = new Map<string, Set<string>>()
  const activityTagCandidates = new Map<string, CandidateRecord>()
  let nextId = 1

  type Snapshot = {
    tags: TagRecord[]
    activityTags: ActivityTagRecord[]
    activityTagCandidates: CandidateRecord[]
  }

  const restoreState = (state: Snapshot) => {
    tags.clear()
    tagsBySlug.clear()
    activityTags.clear()
    activityTagCandidates.clear()
    nextId = 1

    state.tags.forEach((tag) => {
      const record: TagRecord = { ...tag, activitiesCount: tag.activitiesCount ?? 0 }
      tags.set(record.id, record)
      tagsBySlug.set(record.slug, record.id)
      const numeric = Number.parseInt(record.id.replace(/\D+/g, ""), 10)
      if (!Number.isNaN(numeric)) {
        nextId = Math.max(nextId, numeric + 1)
      }
    })

    state.activityTags.forEach(({ activityId, tagId }) => {
      if (!activityTags.has(activityId)) {
        activityTags.set(activityId, new Set())
      }
      activityTags.get(activityId)!.add(tagId)
    })

    state.activityTagCandidates.forEach((candidate) => {
      activityTagCandidates.set(candidate.slug, { ...candidate })
    })
  }

  initial?.tags?.forEach((tag) => {
    const record: TagRecord = { ...tag, activitiesCount: tag.activitiesCount ?? 0 }
    tags.set(tag.id, record)
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

  const inferredCounts = new Map<string, number>()
  initial?.activityTags?.forEach((relation) => {
    const tag = tags.get(relation.tagId)
    if (!tag || typeof tag.activitiesCount === "number") return
    inferredCounts.set(relation.tagId, (inferredCounts.get(relation.tagId) ?? 0) + 1)
  })

  inferredCounts.forEach((count, tagId) => {
    const tag = tags.get(tagId)
    if (!tag) return
    tags.set(tagId, { ...tag, activitiesCount: count })
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
      groupBy: async (args: any) => {
        const targetActivityIds: Set<string> | null = args?.where?.activityId?.in
          ? new Set(args?.where?.activityId?.in)
          : null
        const counts = new Map<string, number>()
        activityTags.forEach((tagSet, activityId) => {
          if (targetActivityIds && !targetActivityIds.has(activityId)) return
          tagSet.forEach((tagId) => counts.set(tagId, (counts.get(tagId) ?? 0) + 1))
        })
        return Array.from(counts.entries()).map(([tagId, count]) => ({
          tagId,
          _count: { _all: count },
        }))
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
          activitiesCount: args?.data?.activitiesCount ?? 0,
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
          activitiesCount: args?.create?.activitiesCount ?? 0,
        }
        tags.set(id, record)
        tagsBySlug.set(slug, id)
        return { ...record }
      },
      update: async (args: any) => {
        const id: string | undefined = args?.where?.id
        if (!id) throw new Error("update requires id")

        const record = tags.get(id)
        if (!record) throw new Error(`tag ${id} not found`)

        const increment = args?.data?.activitiesCount?.increment ?? 0
        const decrement = args?.data?.activitiesCount?.decrement ?? 0
        const nextCount = (record.activitiesCount ?? 0) + increment - decrement

        const updated: TagRecord = {
          ...record,
          activitiesCount: nextCount,
        }
        tags.set(id, updated)
        return { ...updated }
      },
      updateMany: async (args: any) => {
        const ids: string[] | undefined = args?.where?.id?.in
        if (!ids || ids.length === 0) return { count: 0 }

        const increment = args?.data?.activitiesCount?.increment ?? 0
        const decrement = args?.data?.activitiesCount?.decrement ?? 0

        ids.forEach((id) => {
          const record = tags.get(id)
          if (!record) return

          const nextCount = (record.activitiesCount ?? 0) + increment - decrement
          tags.set(id, { ...record, activitiesCount: nextCount })
        })

        return { count: ids.length }
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
  } as unknown as Prisma.TransactionClient

  const snapshot = (): Snapshot => ({
    tags: Array.from(tags.values()),
    activityTags: Array.from(activityTags.entries()).flatMap(([activityId, set]) =>
      Array.from(set).map((tagId) => ({ activityId, tagId }))
    ),
    activityTagCandidates: Array.from(activityTagCandidates.values()),
  })

  const runInTransaction = async <T>(operation: (client: typeof tx) => Promise<T>): Promise<T> => {
    const backup = snapshot()
    try {
      return await operation(tx)
    } catch (error) {
      restoreState(backup)
      throw error
    }
  }

  return { tx, snapshot, runInTransaction }
}
