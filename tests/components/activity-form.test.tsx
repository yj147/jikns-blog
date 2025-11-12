import { describe, it, expect } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

import { ActivityForm } from "@/components/activity/activity-form"
import type { ActivityWithAuthor } from "@/types/activity"

vi.mock("sonner", () => ({
  toast: Object.assign(() => undefined, {
    error: () => undefined,
    success: () => undefined,
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined }),
}))

vi.mock("@/app/providers/auth-provider", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "测试用户",
      role: "ADMIN",
      avatarUrl: null,
    },
  }),
}))

vi.mock("@/hooks/use-activities", () => ({
  useActivityMutations: () => ({
    createActivity: async () => {
      throw new Error("not implemented in test")
    },
    updateActivity: async () => {
      throw new Error("not implemented in test")
    },
    deleteActivity: async () => {
      throw new Error("not implemented in test")
    },
    isLoading: false,
    error: null,
  }),
  useImageUpload: () => ({
    uploadImages: async () => [],
    isUploading: false,
    uploadProgress: {},
  }),
}))

describe("ActivityForm", () => {
  const buildActivity = (overrides: Partial<ActivityWithAuthor>): ActivityWithAuthor => ({
    id: "activity-id",
    content: "默认内容",
    imageUrls: ["https://cdn.example.com/example.jpg"],
    isPinned: false,
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorId: "author-1",
    author: {
      id: "author-1",
      name: "作者",
      avatarUrl: null,
      role: "ADMIN",
    },
    ...overrides,
  })

  it("resets fields and images when initialData changes in edit mode", async () => {
    const firstActivity = buildActivity({
      id: "activity-a",
      content: "动态 A",
      imageUrls: ["https://cdn.example.com/a.jpg"],
    })

    const secondActivity = buildActivity({
      id: "activity-b",
      content: "动态 B",
      imageUrls: [],
    })

    const { rerender } = render(
      <ActivityForm mode="edit" initialData={firstActivity} onSuccess={() => undefined} />
    )

    const textarea = screen.getByPlaceholderText("分享你的想法...") as HTMLTextAreaElement
    expect(textarea.value).toBe("动态 A")
    expect(screen.getByAltText("图片 1")).toBeInTheDocument()

    rerender(<ActivityForm mode="edit" initialData={secondActivity} onSuccess={() => undefined} />)

    await waitFor(() => {
      expect(textarea.value).toBe("动态 B")
    })

    await waitFor(() => {
      expect(screen.queryByAltText("图片 1")).toBeNull()
    })
  })
})
