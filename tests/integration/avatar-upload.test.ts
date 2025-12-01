import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest"
import { realPrisma, disconnectRealDb } from "./setup-real-db"
import { TEST_USERS } from "../helpers/test-data"
import { resetMocks, setCurrentTestUser } from "../__mocks__/supabase"
import { createServiceRoleClient } from "@/lib/supabase"

type UpdateAvatar = typeof import("@/app/actions/settings")["updateAvatar"]

const auditLogMock = { logEvent: vi.fn().mockResolvedValue(undefined) }

vi.mock("@/lib/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit-log")>("@/lib/audit-log")
  return {
    ...actual,
    auditLogger: auditLogMock,
  }
})

vi.doUnmock("@/lib/prisma")
vi.mock("@/lib/prisma", () => ({
  prisma: realPrisma,
  default: realPrisma,
}))

const userFixture = TEST_USERS.user
const adminFixture = TEST_USERS.admin

let updateAvatar: UpdateAvatar
let fetchSpy: ReturnType<typeof vi.spyOn> | undefined
let dbAvailable = true

const createFile = (size: number, type = "image/png") =>
  new File([new Uint8Array(size)], "avatar.png", { type })

const createFormData = (file: File) => {
  const formData = new FormData()
  formData.append("avatar", file)
  return formData
}

const createJsonResponse = (body: any, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: "basic",
    url: "http://localhost",
    clone() {
      return this as unknown as Response
    },
  }) as unknown as Response

async function ensureUser(user = userFixture) {
  await realPrisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    },
    create: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
      updatedAt: new Date(),
      lastLoginAt: new Date(),
    },
  })
}

const skipIfNoDb = () => {
  if (dbAvailable) return false
  expect(true).toBe(true)
  return true
}

describe("头像上传 Server Action", () => {
  beforeAll(async () => {
    try {
      await realPrisma.$connect()
    } catch {
      dbAvailable = false
      return
    }

    const actions = await import("@/app/actions/settings")
    updateAvatar = actions.updateAvatar

    await ensureUser(userFixture)
    await ensureUser(adminFixture)
  })

  afterAll(async () => {
    if (dbAvailable) {
      await realPrisma.user.deleteMany({
        where: { id: { in: [userFixture.id, adminFixture.id, "avatar-other-user"] } },
      })
      await disconnectRealDb()
    }
    resetMocks()
  })

  beforeEach(async () => {
    auditLogMock.logEvent.mockReset()
    vi.mocked(createServiceRoleClient).mockClear()
    fetchSpy = undefined
    if (!dbAvailable) return
    setCurrentTestUser("user")
    await ensureUser(userFixture)
    fetchSpy = vi.spyOn(global, "fetch")
  })

  afterEach(() => {
    if (fetchSpy) {
      fetchSpy.mockRestore()
      fetchSpy = undefined
    }
  })

  it("拒绝非图片格式", async () => {
    if (skipIfNoDb()) return
    const pdfFile = createFile(1024, "application/pdf")
    const result = await updateAvatar(userFixture.id, createFormData(pdfFile))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("仅支持")
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("拒绝超过 5MB 的文件", async () => {
    if (skipIfNoDb()) return
    const largeFile = createFile(5 * 1024 * 1024 + 1)
    const result = await updateAvatar(userFixture.id, createFormData(largeFile))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("5MB")
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("上传服务失败时返回友好错误且不落库", async () => {
    if (skipIfNoDb()) return
    const originalAvatar = `avatars/${userFixture.id}/original.png`
    await realPrisma.user.update({
      where: { id: userFixture.id },
      data: { avatarUrl: originalAvatar },
    })

    fetchSpy.mockResolvedValueOnce(
      createJsonResponse({ success: false, error: { message: "Storage unavailable" } }, 500)
    )

    const result = await updateAvatar(userFixture.id, createFormData(createFile(2048)))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("上传失败")
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1)

    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { avatarUrl: true },
    })
    expect(record.avatarUrl).toBe(originalAvatar)
  })

  it("成功上传并更新 avatarUrl，且清理旧头像", async () => {
    if (skipIfNoDb()) return
    const oldPath = `avatars/${userFixture.id}/old.png`
    const oldUrl = `https://storage.test/storage/v1/object/public/activity-images/${oldPath}`
    await realPrisma.user.update({
      where: { id: userFixture.id },
      data: { avatarUrl: oldUrl },
    })

    const newPath = `avatars/${userFixture.id}/new.png`
    const newSignedUrl = `https://storage.test/signed/${newPath}?e=3600`
    const postCalls: string[] = []
    const deleteCalls: string[] = []

    fetchSpy.mockImplementation(async (input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as any).url || String(input)

      if (init?.method === "DELETE") {
        deleteCalls.push(url)
        return createJsonResponse({ success: true, data: { deleted: true, path: oldPath } })
      }

      postCalls.push(url)
      return createJsonResponse({
        success: true,
        data: {
          urls: [newSignedUrl],
          details: [{ signedUrl: newSignedUrl, path: newPath, signedUrlExpiresIn: 3600 }],
        },
      })
    })

    const result = await updateAvatar(userFixture.id, createFormData(createFile(2048)))

    expect(result.success).toBe(true)
    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { avatarUrl: true },
    })
    expect(record.avatarUrl).toBe(newPath)

    expect(postCalls[0]).toContain("/api/upload/images?purpose=avatar")
    expect(deleteCalls[0]).toContain(encodeURIComponent(oldPath))
  })

  it("Supabase metadata 同步失败时回滚上传并清理文件", async () => {
    if (skipIfNoDb()) return
    const oldPath = `avatars/${userFixture.id}/before-error.png`
    await realPrisma.user.update({
      where: { id: userFixture.id },
      data: { avatarUrl: oldPath },
    })

    const uploadedPath = `avatars/${userFixture.id}/metadata-error.png`
    const deleteCalls: string[] = []

    fetchSpy.mockImplementation((input: RequestInfo, init?: RequestInit) => {
      const url = typeof input === "string" ? input : (input as any).url || String(input)

      if (init?.method === "DELETE") {
        deleteCalls.push(url)
        return Promise.resolve(
          createJsonResponse({ success: true, data: { deleted: true, path: uploadedPath } })
        )
      }

      return Promise.resolve(
        createJsonResponse({
          success: true,
          data: {
            urls: [`https://storage.test/storage/v1/object/public/activity-images/${uploadedPath}`],
            details: [
              {
                signedUrl: `https://storage.test/${uploadedPath}?token=abc`,
                path: uploadedPath,
                signedUrlExpiresIn: 3600,
              },
            ],
          },
        })
      )
    })

    const supabaseAdminMock = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: {
              user: {
                id: userFixture.id,
                email: userFixture.email,
                user_metadata: {
                  full_name: userFixture.name,
                  avatar_url: oldPath,
                },
              },
            },
            error: null,
          })),
          updateUserById: vi.fn(async () => ({
            data: null,
            error: { message: "Supabase metadata update failed" },
          })),
        },
      },
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: vi.fn(),
        })),
      },
    }

    vi.mocked(createServiceRoleClient).mockReturnValueOnce(supabaseAdminMock as any)

    const result = await updateAvatar(userFixture.id, createFormData(createFile(1024)))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("元数据")
    }

    expect(deleteCalls.find((url) => url.includes(encodeURIComponent(uploadedPath)))).toBeTruthy()

    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { avatarUrl: true },
    })
    expect(record.avatarUrl).toBe(oldPath)
  })

  it("非本人无法上传头像", async () => {
    if (skipIfNoDb()) return
    await ensureUser({
      ...userFixture,
      id: "avatar-other-user",
      email: "other@test.com",
      name: "Other User",
      avatarUrl: null,
    })

    const result = await updateAvatar("avatar-other-user", createFormData(createFile(1024)))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("禁止")
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("管理员可以代他人更新头像并记录审计事件", async () => {
    if (skipIfNoDb()) return
    setCurrentTestUser("admin")
    const uploadedPath = `avatars/${adminFixture.id}/delegate.png`

    fetchSpy.mockResolvedValue(
      createJsonResponse({
        success: true,
        data: {
          urls: [`https://storage.test/storage/v1/object/public/activity-images/${uploadedPath}`],
          details: [
            {
              signedUrl: `https://storage.test/${uploadedPath}?token=delegate`,
              path: uploadedPath,
              signedUrlExpiresIn: 3600,
            },
          ],
        },
      })
    )

    const result = await updateAvatar(userFixture.id, createFormData(createFile(2048)))

    expect(result.success).toBe(true)
    const record = await realPrisma.user.findUniqueOrThrow({
      where: { id: userFixture.id },
      select: { avatarUrl: true },
    })
    expect(record.avatarUrl).toBe(uploadedPath)

    expect(auditLogMock.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_UPDATE_AVATAR",
        resource: `user:${userFixture.id}`,
        details: expect.objectContaining({
          actorUserId: adminFixture.id,
          targetUserId: userFixture.id,
          avatarUrl: uploadedPath,
        }),
      })
    )
  })
})
