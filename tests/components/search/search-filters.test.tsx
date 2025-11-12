import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { endOfDay, startOfDay } from "date-fns"
import { SearchFilters } from "@/components/search/search-filters"
import type { ParsedSearchParams } from "@/lib/search/search-params"
import { searchTags, getTag } from "@/lib/actions/tags"
import { searchAuthorCandidates } from "@/lib/actions/search"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock("@/hooks/use-debounce", () => ({
  useDebounce: <T,>(value: T) => value,
}))

vi.mock("@/lib/actions/tags", () => ({
  searchTags: vi.fn().mockResolvedValue({ success: true, data: { tags: [] } }),
  getTag: vi.fn().mockResolvedValue({ success: true, data: { tag: null } }),
}))

vi.mock("@/lib/actions/search", () => ({
  searchAuthorCandidates: vi.fn().mockResolvedValue({
    success: true,
    data: { authors: [] },
  }),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked: boolean
    onCheckedChange: (value: boolean) => void
    id?: string
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
  ),
}))

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}))

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (date?: Date) => void }) => (
    <div onClick={() => onSelect(new Date("2024-01-01"))}>calendar</div>
  ),
}))

vi.mock("@/lib/utils", () => ({
  cn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(" ")),
}))

vi.mock("lucide-react", () => ({
  CalendarIcon: () => <span>calendar-icon</span>,
  X: () => <span>x-icon</span>,
  CircleIcon: () => <span>circle-icon</span>,
  Loader2: () => <span>loader-icon</span>,
  Hash: () => <span>hash-icon</span>,
  User: () => <span>user-icon</span>,
}))

const createInitialParams = (overrides: Partial<ParsedSearchParams> = {}): ParsedSearchParams => ({
  query: "",
  type: "all",
  page: 1,
  authorId: undefined,
  tagIds: [],
  publishedFrom: undefined,
  publishedTo: undefined,
  onlyPublished: true,
  sort: "relevance",
  ...overrides,
})

describe("SearchFilters 行为", () => {
  beforeEach(() => {
    mockPush.mockReset()
    vi.mocked(searchTags).mockResolvedValue({ success: true, data: { tags: [] } })
    vi.mocked(getTag).mockResolvedValue({ success: true, data: { tag: null } })
    vi.mocked(searchAuthorCandidates).mockResolvedValue({
      success: true,
      data: { authors: [] },
    })
  })

  it("非法日期参数不会破坏组件", () => {
    render(
      <SearchFilters
        allowDraftToggle
        initialParams={createInitialParams({ publishedTo: new Date("2024-01-01T00:00:00Z") })}
      />
    )

    expect(screen.getAllByText("选择日期").length).toBeGreaterThan(0)
    expect(screen.getByText(/2024/)).toBeInTheDocument()
  })

  it("取消仅显示已发布时应写入 onlyPublished=false", () => {
    render(
      <SearchFilters allowDraftToggle initialParams={createInitialParams({ query: "test" })} />
    )

    const checkbox = screen.getByLabelText("仅显示已发布内容")
    fireEvent.click(checkbox)

    const applyButton = screen.getByText("应用过滤器")
    fireEvent.click(applyButton)

    expect(mockPush).toHaveBeenCalledWith("/search?q=test&onlyPublished=false")
  })

  it("应用日期过滤时应序列化为包含时区的 ISO 字符串", () => {
    render(<SearchFilters initialParams={createInitialParams({ query: "test" })} />)

    const calendars = screen.getAllByText("calendar")
    calendars.forEach((calendar) => fireEvent.click(calendar))

    const applyButton = screen.getByText("应用过滤器")
    fireEvent.click(applyButton)

    expect(mockPush).toHaveBeenCalled()
    const targetUrl = mockPush.mock.calls[mockPush.mock.calls.length - 1]?.[0]
    expect(targetUrl).toBeDefined()

    const parsedUrl = new URL(targetUrl as string, "https://example.com")
    const fromParam = parsedUrl.searchParams.get("publishedFrom")
    const toParam = parsedUrl.searchParams.get("publishedTo")

    expect(fromParam).toBeDefined()
    expect(toParam).toBeDefined()

    const expectedFrom = startOfDay(new Date("2024-01-01")).toISOString()
    const expectedTo = endOfDay(new Date("2024-01-01")).toISOString()

    expect(fromParam).toBe(expectedFrom)
    expect(toParam).toBe(expectedTo)
  })
})

it("未授权用户不展示仅已发布开关", () => {
  render(<SearchFilters initialParams={createInitialParams({ query: "test" })} />)

  expect(screen.queryByLabelText("仅显示已发布内容")).toBeNull()

  const applyButton = screen.getByText("应用过滤器")
  fireEvent.click(applyButton)

  expect(mockPush).toHaveBeenCalledWith("/search?q=test")
})

it("选择标签后应用过滤器应写入 tagIds", async () => {
  vi.mocked(searchTags).mockResolvedValue({
    success: true,
    data: {
      tags: [
        {
          id: "tag-1",
          name: "Next.js",
          slug: "nextjs",
          description: null,
          color: null,
          postsCount: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    },
  })

  render(<SearchFilters initialParams={createInitialParams({ query: "test" })} />)

  fireEvent.change(screen.getByPlaceholderText("搜索标签..."), { target: { value: "Ne" } })

  await waitFor(() => expect(screen.getByText("Next.js")).toBeInTheDocument())

  fireEvent.click(screen.getByText("Next.js"))
  fireEvent.click(screen.getByText("应用过滤器"))

  expect(mockPush).toHaveBeenCalled()
  const targetUrl = mockPush.mock.calls.at(-1)?.[0] as string
  const parsedUrl = new URL(targetUrl, "https://example.com")
  expect(parsedUrl.searchParams.getAll("tagIds")).toEqual(["tag-1"])
})

it("选择作者后应用过滤器应写入 authorId", async () => {
  vi.mocked(searchAuthorCandidates).mockResolvedValue({
    success: true,
    data: {
      authors: [
        {
          id: "author-1",
          name: "Linus",
          avatarUrl: null,
          bio: "Creator",
          role: "ADMIN",
          similarity: 1,
        },
      ],
    },
  })

  render(<SearchFilters initialParams={createInitialParams({ query: "test" })} />)

  fireEvent.change(screen.getByPlaceholderText("搜索作者..."), { target: { value: "Li" } })

  await waitFor(() => expect(screen.getByText("Linus")).toBeInTheDocument())

  fireEvent.click(screen.getByText("Linus"))
  fireEvent.click(screen.getByText("应用过滤器"))

  expect(mockPush).toHaveBeenCalled()
  const targetUrl = mockPush.mock.calls.at(-1)?.[0] as string
  const parsedUrl = new URL(targetUrl, "https://example.com")
  expect(parsedUrl.searchParams.get("authorId")).toBe("author-1")
})
