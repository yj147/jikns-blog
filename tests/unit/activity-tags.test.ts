import { beforeEach, describe, expect, it } from "vitest"
import { extractActivityHashtags, syncActivityTags } from "@/lib/services/activity-tags"
import { createFakeTransactionClient } from "../helpers/fake-activity-tags-client"

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
          { id: "tag-1", name: "React", slug: "react", activitiesCount: 0 },
          { id: "tag-2", name: "Vue", slug: "vue", activitiesCount: 1 },
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
      const snapshot = store.snapshot()
      expect(snapshot.activityTags).toEqual([])
      const removedTag = snapshot.tags.find((tag) => tag.slug === "vue")
      expect(removedTag?.activitiesCount).toBe(0)
    })

    it("updates activitiesCount when replacing tags", async () => {
      store = createFakeTransactionClient({
        tags: [
          { id: "tag-1", name: "React", slug: "react", activitiesCount: 1 },
          { id: "tag-2", name: "Vue", slug: "vue", activitiesCount: 0 },
        ],
        activityTags: [{ activityId: "act-1", tagId: "tag-1" }],
      })

      await syncActivityTags({
        tx: store.tx,
        activityId: "act-1",
        rawTagNames: ["Vue"],
      })

      const snapshot = store.snapshot()
      const react = snapshot.tags.find((tag) => tag.slug === "react")
      const vue = snapshot.tags.find((tag) => tag.slug === "vue")

      expect(react?.activitiesCount).toBe(0)
      expect(vue?.activitiesCount).toBe(1)
      expect(snapshot.activityTags).toEqual([{ activityId: "act-1", tagId: "tag-2" }])
    })

    it("keeps activitiesCount unchanged when tags stay the same", async () => {
      store = createFakeTransactionClient({
        tags: [{ id: "tag-1", name: "React", slug: "react", activitiesCount: 2 }],
        activityTags: [
          { activityId: "act-1", tagId: "tag-1" },
          { activityId: "act-2", tagId: "tag-1" },
        ],
      })

      await syncActivityTags({
        tx: store.tx,
        activityId: "act-2",
        rawTagNames: ["React"],
      })

      const react = store.snapshot().tags.find((tag) => tag.slug === "react")
      expect(react?.activitiesCount).toBe(2)
    })
  })
})
