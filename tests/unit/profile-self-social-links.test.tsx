import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

import ProfilePage from "@/app/profile/page"

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/profile/profile-activities-tab", () => ({
  ProfileActivitiesTab: ({ userId }: { userId: string }) => (
    <div data-testid={`activities-${userId}`} />
  ),
}))

vi.mock("@/components/profile/profile-likes-tab", () => ({
  ProfileLikesTab: ({ userId }: { userId: string }) => <div data-testid={`likes-${userId}`} />,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    post: {
      findMany: vi.fn(),
    },
  }
  return { prisma }
})

vi.mock("@/lib/actions/auth", () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock("@/lib/profile/stats", () => ({
  getQuickStats: vi.fn(),
  EMPTY_QUICK_STATS: {
    monthlyPosts: 0,
    totalViews: 0,
    totalLikes: 0,
    totalComments: 0,
  },
}))

// 加载被 mock 的函数，便于设置返回值
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/actions/auth"
import { getQuickStats } from "@/lib/profile/stats"

describe("ProfilePage (self) social links", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.user.findUnique.mockResolvedValue({
      _count: { followers: 0, following: 0, posts: 0, activities: 0 },
    })
    prisma.post.findMany.mockResolvedValue([])
    vi.mocked(getQuickStats).mockResolvedValue({
      monthlyPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
    })
  })

  it("renders saved social link values instead of just labels", async () => {
    const user = {
      id: "user-123",
      email: "self@example.com",
      name: "Self User",
      avatarUrl: null,
      bio: "bio",
      role: "USER" as const,
      status: "ACTIVE" as const,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      lastLoginAt: new Date("2024-02-01T00:00:00Z"),
      socialLinks: {
        website: "https://self.example.com",
        github: "https://github.com/self-user",
        twitter: "https://x.com/self-user",
        linkedin: "https://linkedin.com/in/self-user",
      },
    }

    vi.mocked(getCurrentUser).mockResolvedValue(user as any)

    const ui = await ProfilePage()
    render(ui)

    await waitFor(() => {
      expect(screen.getByText("https://self.example.com")).toBeInTheDocument()
    })

    expect(screen.getByText("https://github.com/self-user")).toBeInTheDocument()
    expect(screen.getByText("https://x.com/self-user")).toBeInTheDocument()
    expect(screen.getByText("https://linkedin.com/in/self-user")).toBeInTheDocument()
  })
})
