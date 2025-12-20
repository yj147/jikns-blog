import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { getAllSettings, getSetting, setSetting } from "@/lib/services/system-settings"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

vi.mock("@/lib/audit-log", () => ({
  auditLogger: { logEvent: vi.fn() },
  AuditEventType: { ADMIN_ACTION: "ADMIN_ACTION" },
  getClientIP: vi.fn(() => "127.0.0.1"),
  getClientUserAgent: vi.fn(() => "vitest-agent"),
}))

vi.mock("@/lib/permissions", () => ({
  validateApiPermissions: vi.fn(),
}))

let prisma: Awaited<ReturnType<typeof import("@/lib/prisma")>>["prisma"]

describe("system settings service", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    prisma = (await import("@/lib/prisma")).prisma
  })

  it("getAllSettings 应该返回键值映射", async () => {
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValueOnce([
      { key: "site.general", value: { name: "Blog" } },
      { key: "registration.toggle", value: { enabled: true } },
    ] as any)

    const result = await getAllSettings()

    expect(result).toEqual({
      "site.general": { name: "Blog" },
      "registration.toggle": { enabled: true },
    })
    expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
      select: { key: true, value: true },
    })
  })

  it("getSetting 应该返回指定键或 null", async () => {
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValueOnce({
      value: { title: "Home" },
    } as any)

    const value = await getSetting<{ title: string }>("seo.meta")
    expect(value?.title).toBe("Home")

    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValueOnce(null)
    const missing = await getSetting("not.exists")
    expect(missing).toBeNull()
  })

  it("setSetting 应该写入 updatedById", async () => {
    vi.mocked(prisma.systemSetting.upsert).mockResolvedValueOnce({} as any)

    await setSetting("registration.toggle", { enabled: false }, "user-1")

    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith({
      where: { key: "registration.toggle" },
      update: { value: { enabled: false }, updatedById: "user-1" },
      create: { key: "registration.toggle", value: { enabled: false }, updatedById: "user-1" },
    })
  })
})

describe("admin settings API route", () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    prisma = (await import("@/lib/prisma")).prisma
  })

  it("GET 应该拒绝未授权请求", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: false,
      error: { statusCode: 403, message: "no-permission" },
    } as any)

    const { GET } = await import("@/app/api/admin/settings/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/settings"))
    const payload = await res.json()

    expect(res.status).toBe(403)
    expect(payload.success).toBe(false)
  })

  it("GET 应该使用默认错误信息和状态码", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: false,
      error: {},
    } as any)

    const { GET } = await import("@/app/api/admin/settings/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/settings"))
    const payload = await res.json()

    expect(res.status).toBe(403)
    expect(payload.error.message).toBe("无权读取系统设置")
    expect(payload.error.code).toBe("FORBIDDEN")
  })

  it("GET 应该返回设置与更新时间", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    vi.spyOn(serviceModule, "getAllSettings").mockResolvedValueOnce({
      "site.general": { title: "MyBlog" },
    })

    vi.mocked(prisma.systemSetting.aggregate).mockResolvedValueOnce({
      _max: { updatedAt: new Date("2025-01-02T00:00:00.000Z") },
    } as any)

    const { GET } = await import("@/app/api/admin/settings/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/settings"))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.settings["site.general"].title).toBe("MyBlog")
    expect(payload.data.updatedAt).toBe("2025-01-02T00:00:00.000Z")
  })

  it("GET 应该在无更新时间时返回 null", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    vi.spyOn(serviceModule, "getAllSettings").mockResolvedValueOnce({})

    vi.mocked(prisma.systemSetting.aggregate).mockResolvedValueOnce({
      _max: { updatedAt: null },
    } as any)

    const { GET } = await import("@/app/api/admin/settings/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/settings"))
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.data.updatedAt).toBeNull()
  })

  it("GET 应该在查询失败时返回 500", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    vi.spyOn(serviceModule, "getAllSettings").mockRejectedValueOnce(new Error("db down"))

    const { GET } = await import("@/app/api/admin/settings/route")
    const res = await GET(new NextRequest("http://localhost/api/admin/settings"))
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error.code).toBe("INTERNAL_ERROR")
  })

  it("POST 应该校验请求体", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    const setSettingSpy = vi.spyOn(serviceModule, "setSetting").mockResolvedValueOnce()

    const { POST } = await import("@/app/api/admin/settings/route")
    const res = await POST(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ value: true }),
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error.code).toBe("VALIDATION_ERROR")
    expect(setSettingSpy).not.toHaveBeenCalled()
  })

  it("POST 应该拒绝未授权请求", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: false,
      error: { statusCode: 403, message: "no-auth" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    const setSettingSpy = vi.spyOn(serviceModule, "setSetting")

    const { POST } = await import("@/app/api/admin/settings/route")
    const res = await POST(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key: "site.general", value: {} }),
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(403)
    expect(payload.success).toBe(false)
    expect(setSettingSpy).not.toHaveBeenCalled()
  })

  it("POST 应该使用默认未授权提示", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: false,
      error: {},
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    const setSettingSpy = vi.spyOn(serviceModule, "setSetting")

    const { POST } = await import("@/app/api/admin/settings/route")
    const res = await POST(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key: "foo", value: "bar" }),
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(403)
    expect(payload.error.message).toBe("无权修改系统设置")
    expect(payload.error.code).toBe("FORBIDDEN")
    expect(setSettingSpy).not.toHaveBeenCalled()
  })

  it("POST 应该处理无法解析的 JSON", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    const setSettingSpy = vi.spyOn(serviceModule, "setSetting")

    const { POST } = await import("@/app/api/admin/settings/route")
    const res = await POST(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "POST",
        body: "not-json" as any,
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(400)
    expect(payload.error.code).toBe("VALIDATION_ERROR")
    expect(setSettingSpy).not.toHaveBeenCalled()
  })

  it("POST 应该写入设置并记录审计日志", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    const setSettingSpy = vi.spyOn(serviceModule, "setSetting").mockResolvedValueOnce()
    const auditModule = await import("@/lib/audit-log")
    const auditSpy = vi.mocked(auditModule.auditLogger.logEvent)

    const { POST } = await import("@/app/api/admin/settings/route")
    const res = await POST(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key: "registration.toggle", value: { enabled: true } }),
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data.key).toBe("registration.toggle")
    expect(setSettingSpy).toHaveBeenCalledWith("registration.toggle", { enabled: true }, "admin-1")
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_SETTING_UPSERT",
        userId: "admin-1",
        resource: "setting:registration.toggle",
        success: true,
      })
    )
  })

  it("PUT 应该复用写入逻辑", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    const setSettingSpy = vi.spyOn(serviceModule, "setSetting").mockResolvedValueOnce()

    const { PUT } = await import("@/app/api/admin/settings/route")
    const res = await PUT(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ key: "seo.meta", value: { title: "New" } }),
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(setSettingSpy).toHaveBeenCalledWith("seo.meta", { title: "New" }, "admin-1")
  })

  it("POST 应该处理持久化错误", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    vi.spyOn(serviceModule, "setSetting").mockRejectedValueOnce("write failed")
    const auditModule = await import("@/lib/audit-log")
    const auditSpy = vi.mocked(auditModule.auditLogger.logEvent)

    const { POST } = await import("@/app/api/admin/settings/route")
    const res = await POST(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key: "seo.meta", value: { title: "x" } }),
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error.code).toBe("INTERNAL_ERROR")
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ADMIN_SETTING_UPSERT_FAILED",
        success: false,
      })
    )
  })

  it("POST 应该记录 Error 对象异常信息", async () => {
    const permissionsModule = await import("@/lib/permissions")
    vi.mocked(permissionsModule.validateApiPermissions).mockResolvedValueOnce({
      success: true,
      user: { id: "admin-1" },
    } as any)

    const serviceModule = await import("@/lib/services/system-settings")
    vi.spyOn(serviceModule, "setSetting").mockRejectedValueOnce(new Error("boom"))
    const auditModule = await import("@/lib/audit-log")
    const auditSpy = vi.mocked(auditModule.auditLogger.logEvent)

    const { POST } = await import("@/app/api/admin/settings/route")
    const res = await POST(
      new NextRequest("http://localhost/api/admin/settings", {
        method: "POST",
        body: JSON.stringify({ key: "seo.meta", value: { title: "Boom" } }),
      })
    )
    const payload = await res.json()

    expect(res.status).toBe(500)
    expect(payload.error.code).toBe("INTERNAL_ERROR")
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorMessage: "boom",
        success: false,
      })
    )
  })
})
