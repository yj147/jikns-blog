import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ProfilePage from "@/app/profile/[userId]/page"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/actions/auth"
import { getQuickStats } from "@/lib/profile/stats"
import { notFound } from "next/navigation"

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

vi.mock("@/lib/storage/signed-url", () => ({
  signAvatarUrl: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/components/profile/profile-activities-tab", () => ({
  ProfileActivitiesTab: ({ userId }: { userId: string }) => (
    <div data-testid="activities-tab">activities-{userId}</div>
  ),
}))

vi.mock("@/components/profile/profile-posts-tab", () => ({
  ProfilePostsTab: ({ userId }: { userId: string }) => (
    <div data-testid="posts-tab">posts-{userId}</div>
  ),
}))

vi.mock("@/components/profile/profile-likes-tab", () => ({
  ProfileLikesTab: ({ userId }: { userId: string }) => (
    <div data-testid="likes-tab">likes-{userId}</div>
  ),
}))

vi.mock("@/components/follow", () => ({
  FollowButton: () => <div data-testid="follow-button" />,
}))

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href.href} {...props}>
      {children}
    </a>
  ),
}))

const defaultQuickStats = {
  monthlyPosts: 1,
  totalViews: 2,
  totalLikes: 3,
  totalComments: 4,
}

const baseTargetUser = {
  id: "target-user-123",
  name: "Target User",
  avatarUrl: "https://example.com/avatar.png",
  bio: "A short bio",
  status: "ACTIVE" as "ACTIVE" | "BANNED",
  role: "USER" as "USER" | "ADMIN",
  email: "target@example.com",
  location: "Shanghai",
  phone: "123456789",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  lastLoginAt: new Date("2024-02-01T00:00:00Z"),
  socialLinks: {
    website: "https://example.com",
    github: undefined,
    twitter: undefined,
    linkedin: undefined,
    email: undefined as string | undefined,
  },
  privacySettings: {
    profileVisibility: "public" as const,
    showEmail: true,
    showPhone: true,
    showLocation: true,
  },
  _count: {
    posts: 0,
    activities: 0,
    followers: 0,
    following: 0,
  },
}

const renderProfile = async (viewer: any, targetOverrides: Partial<typeof baseTargetUser> = {}) => {
  const targetUser = {
    ...baseTargetUser,
    ...targetOverrides,
    socialLinks: {
      ...baseTargetUser.socialLinks,
      ...(targetOverrides.socialLinks ?? {}),
    },
    privacySettings: {
      ...baseTargetUser.privacySettings,
      ...(targetOverrides.privacySettings ?? {}),
    },
  }

  if (!(prisma as any).follow) {
    ;(prisma as any).follow = { findUnique: vi.fn() }
  }

  vi.mocked(prisma.user.findUnique).mockResolvedValue(targetUser as any)
  vi.mocked((prisma as any).follow.findUnique).mockResolvedValue(null)
  vi.mocked(getCurrentUser).mockResolvedValue(viewer)
  vi.mocked(getQuickStats).mockResolvedValue(defaultQuickStats)

  const ui = await ProfilePage({
    params: Promise.resolve({ userId: targetUser.id }),
  })

  render(ui)
}

describe("ProfilePage social links display", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders clickable social link values when public", async () => {
    await renderProfile(
      { id: "viewer-1" },
      {
        socialLinks: {
          website: "https://my-site.example",
          email: "mailto:contact@my-site.example",
          github: "https://github.com/example",
          linkedin: "https://linkedin.com/in/example",
        },
        privacySettings: { showEmail: true },
      }
    )

    expect(notFound).not.toHaveBeenCalled()

    const websiteText = screen.getByText("https://my-site.example")
    const websiteLink = websiteText.closest("a")
    expect(websiteLink).toHaveAttribute("href", "https://my-site.example")

    const emailText = screen.getByText("contact@my-site.example")
    const emailLink = emailText.closest("a")
    expect(emailLink).toHaveAttribute("href", "mailto:contact@my-site.example")

    const githubText = screen.getByText("https://github.com/example")
    expect(githubText.closest("a")).toHaveAttribute("href", "https://github.com/example")

    const linkedinText = screen.getByText("https://linkedin.com/in/example")
    expect(linkedinText.closest("a")).toHaveAttribute("href", "https://linkedin.com/in/example")
  })

  it("hides email link from other viewers when email visibility is off", async () => {
    await renderProfile(
      { id: "viewer-2" },
      {
        socialLinks: {
          website: "https://hidden-email.example",
          email: undefined,
        },
        privacySettings: { showEmail: false },
      }
    )

    expect(notFound).not.toHaveBeenCalled()
    expect(screen.getByText("https://hidden-email.example")).toBeInTheDocument()
    expect(screen.queryByText("target@example.com")).not.toBeInTheDocument()
  })

  it("shows email to the owner regardless of email visibility setting", async () => {
    await renderProfile(
      { id: baseTargetUser.id },
      {
        socialLinks: { email: undefined },
        privacySettings: { showEmail: false },
      }
    )

    const emailText = screen.getByText("target@example.com")
    const emailLink = emailText.closest("a")
    expect(emailLink).toHaveAttribute("href", "mailto:target@example.com")
  })

  it("shows login call-to-action when viewer is anonymous", async () => {
    await renderProfile(null, {})

    expect(screen.getByText("登录后关注")).toBeInTheDocument()
  })

  it("renders admin badge for admin profile", async () => {
    await renderProfile(
      { id: "viewer-3" },
      {
        role: "ADMIN",
      }
    )

    expect(screen.getAllByText("管理员")).not.toHaveLength(0)
  })
})
