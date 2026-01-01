import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { extractTocItems } from "@/lib/markdown/toc"

describe("extractTocItems", () => {
  it("skips fenced code blocks and keeps heading ids stable", () => {
    const content = [
      "# Title",
      "## Intro",
      "```md",
      "## Intro",
      "### Sub",
      "```",
      "## Intro",
      "### Sub",
      "",
    ].join("\n")

    expect(extractTocItems(content)).toEqual([
      { id: "intro", text: "Intro", level: 2 },
      { id: "intro-1", text: "Intro", level: 2 },
      { id: "sub", text: "Sub", level: 3 },
    ])
  })
})
