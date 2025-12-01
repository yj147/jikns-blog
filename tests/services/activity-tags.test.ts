import { describe, expect, it } from "vitest"
import { syncActivityTags } from "@/lib/services/activity-tags"
import { createFakeTransactionClient } from "../helpers/fake-activity-tags-client"

describe("activitiesCount 实时维护", () => {
  it("创建动态时为关联标签计数 +1", async () => {
    const store = createFakeTransactionClient({
      tags: [{ id: "tag-1", name: "React", slug: "react", activitiesCount: 0 }],
    })

    await store.runInTransaction((tx) =>
      syncActivityTags({ tx, activityId: "act-1", rawTagNames: ["React"] })
    )

    const react = store.snapshot().tags.find((tag) => tag.id === "tag-1")
    expect(react?.activitiesCount).toBe(1)
    expect(store.snapshot().activityTags).toEqual([{ activityId: "act-1", tagId: "tag-1" }])
  })

  it("删除动态时批量为所有标签计数 -1", async () => {
    const store = createFakeTransactionClient({
      tags: [
        { id: "tag-1", name: "React", slug: "react", activitiesCount: 1 },
        { id: "tag-2", name: "Vue", slug: "vue", activitiesCount: 1 },
      ],
      activityTags: [
        { activityId: "act-1", tagId: "tag-1" },
        { activityId: "act-1", tagId: "tag-2" },
      ],
    })

    await store.runInTransaction(async (tx) => {
      const links = await tx.activityTag.findMany({
        where: { activityId: "act-1" },
        select: { tagId: true },
      })
      const tagIds = Array.from(new Set(links.map((link) => link.tagId)))
      await tx.activityTag.deleteMany({ where: { activityId: "act-1" } })
      await tx.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { activitiesCount: { decrement: 1 } },
      })
    })

    const snapshot = store.snapshot()
    expect(snapshot.activityTags).toEqual([])
    expect(snapshot.tags.find((tag) => tag.id === "tag-1")?.activitiesCount).toBe(0)
    expect(snapshot.tags.find((tag) => tag.id === "tag-2")?.activitiesCount).toBe(0)
  })

  it("更新标签时删除旧标签并新增新标签，计数对称增减", async () => {
    const store = createFakeTransactionClient({
      tags: [
        { id: "tag-1", name: "React", slug: "react", activitiesCount: 1 },
        { id: "tag-2", name: "Vue", slug: "vue", activitiesCount: 0 },
      ],
      activityTags: [{ activityId: "act-1", tagId: "tag-1" }],
    })

    await store.runInTransaction((tx) =>
      syncActivityTags({ tx, activityId: "act-1", rawTagNames: ["Vue"] })
    )

    const snapshot = store.snapshot()
    expect(snapshot.activityTags).toEqual([{ activityId: "act-1", tagId: "tag-2" }])
    expect(snapshot.tags.find((tag) => tag.id === "tag-1")?.activitiesCount).toBe(0)
    expect(snapshot.tags.find((tag) => tag.id === "tag-2")?.activitiesCount).toBe(1)
  })

  it("事务回滚后计数不变", async () => {
    const store = createFakeTransactionClient({
      tags: [{ id: "tag-1", name: "React", slug: "react", activitiesCount: 0 }],
    })
    const before = store.snapshot()

    await expect(
      store.runInTransaction(async (tx) => {
        await syncActivityTags({ tx, activityId: "act-err", rawTagNames: ["React"] })
        throw new Error("simulate failure")
      })
    ).rejects.toThrow("simulate failure")

    const after = store.snapshot()
    expect(after).toEqual(before)
  })
})
