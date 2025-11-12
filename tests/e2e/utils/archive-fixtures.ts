import prisma from "@/lib/prisma"
import { buildPostTokens } from "@/lib/search/tokenizer"

const TEST_POST_SLUG = "playwright-archive-test"
const TEST_TAG_SLUG = "playwright-testing"

export async function ensureArchiveSearchFixture() {
  const admin = await prisma.user.findFirst({
    where: { email: "admin@example.com" },
    select: { id: true },
  })

  if (!admin) {
    throw new Error("Admin user not found; ensure prisma seed has run")
  }

  const publishedAt = new Date("2025-02-10T00:00:00.000Z")
  const tokens = buildPostTokens({
    title: "Playwright 归档测试",
    excerpt: "关于 Playwright 的端到端测试记录",
    content:
      "# Playwright 归档测试\n\n这是一篇用于 E2E 的测试文章，包含 Playwright 关键词以触发全文搜索。",
  })

  const post = await prisma.post.upsert({
    where: { slug: TEST_POST_SLUG },
    update: {
      title: "Playwright 归档测试",
      content:
        "# Playwright 归档测试\n\n这是一篇用于 E2E 的测试文章，包含 Playwright 关键词以触发全文搜索。",
      excerpt: "关于 Playwright 的端到端测试记录",
      published: true,
      publishedAt,
      ...tokens,
    },
    create: {
      slug: TEST_POST_SLUG,
      title: "Playwright 归档测试",
      content:
        "# Playwright 归档测试\n\n这是一篇用于 E2E 的测试文章，包含 Playwright 关键词以触发全文搜索。",
      excerpt: "关于 Playwright 的端到端测试记录",
      published: true,
      publishedAt,
      authorId: admin.id,
      ...tokens,
    },
    select: { id: true },
  })

  const tag = await prisma.tag.upsert({
    where: { slug: TEST_TAG_SLUG },
    update: {
      name: "Playwright",
      description: "E2E 测试专用标签",
    },
    create: {
      slug: TEST_TAG_SLUG,
      name: "Playwright",
      description: "E2E 测试专用标签",
      color: "#7C3AED",
    },
    select: { id: true },
  })

  // 确保 PostTag 关联存在（幂等操作）
  const existingPostTag = await prisma.postTag.findUnique({
    where: {
      postId_tagId: {
        postId: post.id,
        tagId: tag.id,
      },
    },
  })

  if (!existingPostTag) {
    await prisma.postTag.create({ data: { postId: post.id, tagId: tag.id } })
  }
}
