import path from "path"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

const mockExecuteRaw = vi.fn()
const mockQueryRaw = vi.fn()
const mockTagFindMany = vi.fn()
const mockTagUpdate = vi.fn()
const mockDisconnect = vi.fn()

const mockPrisma = {
  $executeRaw: mockExecuteRaw,
  $queryRaw: mockQueryRaw,
  tag: {
    findMany: mockTagFindMany,
    update: mockTagUpdate,
  },
  $disconnect: mockDisconnect,
}

vi.mock("@/lib/generated/prisma", () => {
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  }
})

const mkdirMock = vi.fn()
const writeFileMock = vi.fn()

vi.mock("fs", () => ({
  promises: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
  },
  default: {
    promises: {
      mkdir: mkdirMock,
      writeFile: writeFileMock,
    },
  },
}))

const fixedDate = new Date("2025-01-02T03:04:05.678Z")

async function loadModule() {
  return import("@/scripts/reconcile-tag-activities-count")
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(fixedDate)
})

afterEach(() => {
  vi.useRealTimers()
})

describe("reconcileTagActivitiesCount", () => {
  it("adds missing column, fixes mismatched counts and writes report", async () => {
    mockTagFindMany.mockResolvedValue([
      { id: "t1", name: "Tag 1", slug: "tag-1", activitiesCount: 1 },
      { id: "t2", name: "Tag 2", slug: "tag-2", activitiesCount: 0 },
    ])
    mockQueryRaw
      .mockResolvedValueOnce([
        { tagId: "t1", count: 3 },
        { tagId: "t2", count: 0 },
      ])
      .mockResolvedValueOnce([{ activityId: "a-orphan", tagId: "t-missing" }])

    const { reconcileTagActivitiesCount } = await loadModule()
    const result = await reconcileTagActivitiesCount()

    expect(mockExecuteRaw).toHaveBeenCalledTimes(1)
    expect(mockTagUpdate).toHaveBeenCalledTimes(1)
    expect(mockTagUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { activitiesCount: 3 },
    })

    expect(mkdirMock).toHaveBeenCalledWith(path.join(process.cwd(), "monitoring-data"), {
      recursive: true,
    })

    expect(writeFileMock).toHaveBeenCalledTimes(1)
    const [outputPath, payload] = writeFileMock.mock.calls[0]
    expect(outputPath).toContain(
      "monitoring-data/tag-activities-count-reconciliation-2025-01-02T03-04-05-678Z"
    )

    const parsed = JSON.parse(payload as string)
    expect(parsed.reconciledTags).toBe(1)
    expect(parsed.unchangedTags).toBe(1)
    expect(parsed.updated[0]).toMatchObject({
      id: "t1",
      previous: 1,
      actual: 3,
    })
    expect(parsed.orphanRelations).toEqual([{ activityId: "a-orphan", tagId: "t-missing" }])

    expect(result.updated).toHaveLength(1)
    expect(result.orphanRelations).toHaveLength(1)
  })

  it("keeps tags intact when counts already match", async () => {
    mockTagFindMany.mockResolvedValue([
      { id: "t1", name: "Tag 1", slug: "tag-1", activitiesCount: 2 },
    ])
    mockQueryRaw.mockResolvedValueOnce([{ tagId: "t1", count: 2 }]).mockResolvedValueOnce([])

    const { reconcileTagActivitiesCount } = await loadModule()
    const result = await reconcileTagActivitiesCount()

    expect(mockTagUpdate).not.toHaveBeenCalled()
    expect(result.updated).toHaveLength(0)

    const parsed = JSON.parse(writeFileMock.mock.calls[0][1] as string)
    expect(parsed.unchangedTags).toBe(1)
  })

  it("normalizes negative stored counts back to zero", async () => {
    mockTagFindMany.mockResolvedValue([
      { id: "t1", name: "Broken", slug: "broken", activitiesCount: -5 },
    ])
    mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([])

    const { reconcileTagActivitiesCount } = await loadModule()
    await reconcileTagActivitiesCount()

    expect(mockTagUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { activitiesCount: 0 },
    })
  })
})
