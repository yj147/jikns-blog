import { describe, expect, it, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import AdminSettingsPage from "@/app/admin/settings/page"
import { FetchError } from "@/lib/api/fetch-json"

const { fetchGetMock, fetchPostMock, toastMock } = vi.hoisted(() => ({
  fetchGetMock: vi.fn(),
  fetchPostMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock("@/lib/api/fetch-json", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/fetch-json")>("@/lib/api/fetch-json")
  return {
    ...actual,
    fetchGet: fetchGetMock,
    fetchPost: fetchPostMock,
  }
})

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AdminSettingsPage", () => {
  it("显示加载骨架屏", () => {
    fetchGetMock.mockReturnValue(new Promise(() => {}))

    render(<AdminSettingsPage />)

    expect(screen.getByTestId("settings-skeleton")).toBeInTheDocument()
  })

  it("加载后渲染表单并提交 SEO 设置", async () => {
    fetchGetMock.mockResolvedValue({
      success: true,
      data: {
        settings: {
          "seo.meta": { title: "Old Title", description: "Old desc", keywords: ["next", "blog"] },
          "registration.toggle": { enabled: true },
        },
      },
    })
    fetchPostMock.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<AdminSettingsPage />)

    await screen.findByDisplayValue("Old Title")
    await user.clear(screen.getByLabelText("站点标题"))
    await user.type(screen.getByLabelText("站点标题"), "New Title")
    await user.clear(screen.getByLabelText("站点描述"))
    await user.type(screen.getByLabelText("站点描述"), "Better description")
    await user.clear(screen.getByLabelText("关键词"))
    await user.type(screen.getByLabelText("关键词"), "nextjs, blog")

    await user.click(screen.getByRole("button", { name: "保存 SEO 设置" }))

    await waitFor(() => {
      expect(fetchPostMock).toHaveBeenCalledWith("/api/admin/settings", {
        key: "seo.meta",
        value: {
          title: "New Title",
          description: "Better description",
          keywords: ["nextjs", "blog"],
        },
      })
    })
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "SEO 设置已保存" }))
  })

  it("切换注册开关会立即保存", async () => {
    fetchGetMock.mockResolvedValue({
      success: true,
      data: { settings: { "registration.toggle": { enabled: true }, "seo.meta": {} } },
    })
    fetchPostMock.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<AdminSettingsPage />)

    const switchElement = await screen.findByRole("switch", { name: "启用用户注册" })
    expect(switchElement).toBeChecked()

    await user.click(switchElement)

    await waitFor(() => {
      expect(fetchPostMock).toHaveBeenCalledWith("/api/admin/settings", {
        key: "registration.toggle",
        value: { enabled: false },
      })
    })
    expect(switchElement).not.toBeChecked()
  })

  it("保存失败时回滚注册开关并提示错误", async () => {
    fetchGetMock.mockResolvedValue({
      success: true,
      data: { settings: { "registration.toggle": { enabled: true }, "seo.meta": {} } },
    })
    fetchPostMock.mockRejectedValue(new FetchError("保存失败", 500))

    const user = userEvent.setup()
    render(<AdminSettingsPage />)

    const switchElement = await screen.findByRole("switch", { name: "启用用户注册" })
    await user.click(switchElement)

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "保存失败", variant: "destructive" })
      )
    })
    expect(switchElement).toBeChecked()
  })

  it("加载失败时展示错误信息", async () => {
    fetchGetMock.mockRejectedValue(new FetchError("加载失败", 500))

    render(<AdminSettingsPage />)

    await screen.findByText("加载失败")
  })
})
