import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"

import { useIntersectionObserver } from "@/hooks/use-intersection-observer"

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin = ""
  readonly thresholds: ReadonlyArray<number> = []
  private target: Element | null = null

  constructor(private callback: ObserverCallback) {
    MockIntersectionObserver.instances.push(this)
  }

  observe(element: Element) {
    this.target = element
  }

  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  trigger(isIntersecting: boolean) {
    if (!this.target) {
      throw new Error("Target not set")
    }

    this.callback([
      {
        isIntersecting,
        target: this.target,
      } as IntersectionObserverEntry,
    ])
  }

  static instances: MockIntersectionObserver[] = []
}

const originalObserver = global.IntersectionObserver

function TestComponent({ once }: { once?: boolean }) {
  const [ref, visible] = useIntersectionObserver<HTMLDivElement>({ once })
  return (
    <div>
      <div ref={ref} data-testid="target" />
      <span data-testid="state">{visible ? "visible" : "hidden"}</span>
    </div>
  )
}

describe("useIntersectionObserver", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = []
    // @ts-expect-error override for test
    global.IntersectionObserver = MockIntersectionObserver
  })

  afterEach(() => {
    // @ts-expect-error restore
    global.IntersectionObserver = originalObserver
  })

  it("在元素进入视口时标记为可见", () => {
    render(<TestComponent />)

    expect(screen.getByTestId("state").textContent).toBe("hidden")

    const observer = MockIntersectionObserver.instances[0]
    act(() => {
      observer.trigger(true)
    })

    expect(screen.getByTestId("state").textContent).toBe("visible")

    act(() => {
      observer.trigger(false)
    })
    expect(screen.getByTestId("state").textContent).toBe("hidden")
  })

  it("在 once 模式下保持为 true", () => {
    render(<TestComponent once />)

    const observer = MockIntersectionObserver.instances[0]
    act(() => {
      observer.trigger(true)
    })
    expect(screen.getByTestId("state").textContent).toBe("visible")

    act(() => {
      observer.trigger(false)
    })
    expect(screen.getByTestId("state").textContent).toBe("visible")
  })
})
