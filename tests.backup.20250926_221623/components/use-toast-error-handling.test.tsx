/**
 * Toast 错误处理系统测试
 * 验证新统一架构下的错误提示精度和向下兼容性
 */

import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { vi, expect, describe, it, beforeEach } from "vitest"
import { useToast } from "@/hooks/use-toast"
import { AuthError } from "@/lib/error-handling/auth-error"

// Mock AuthError constructor with Vitest
vi.mock("@/lib/error-handling/auth-error", () => ({
  AuthError: vi.fn().mockImplementation((message, code) => ({
    message,
    code,
    name: "AuthError",
  })),
  isAuthError: vi.fn((error) => error?.name === "AuthError"),
}))

// 测试组件
function TestComponent({ error }: { error: any }) {
  const { handleAuthError } = useToast()

  React.useEffect(() => {
    if (error) {
      handleAuthError(error)
    }
  }, [error, handleAuthError])

  return <div data-testid="test-component">Test Component</div>
}

describe("Toast错误处理系统", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("JWT 错误处理", () => {
    it("应该正确处理 JWT expired 错误", async () => {
      const error = { message: "JWT expired" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("您的登录已过期，请重新登录", "SESSION_EXPIRED")
      })
    })

    it("应该正确处理 Invalid JWT 错误", async () => {
      const error = { message: "Invalid JWT token" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("登录信息无效，请重新登录", "INVALID_TOKEN")
      })
    })
  })

  describe("权限错误处理", () => {
    it("应该正确处理权限不足消息错误", async () => {
      const error = { message: "权限不足，无法访问" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("权限不足，无法执行此操作", "FORBIDDEN")
      })
    })

    it("应该正确处理 HTTP 403 错误", async () => {
      const error = { status: 403, message: "Forbidden" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("权限不足，无法执行此操作", "FORBIDDEN")
      })
    })

    it("应该正确处理账户被封禁错误", async () => {
      const error = { message: "账户已被封禁" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("账户已被限制，请联系管理员", "ACCOUNT_BANNED")
      })
    })
  })

  describe("网络错误处理", () => {
    it("应该正确处理 NetworkError", async () => {
      const error = { name: "NetworkError", message: "Network request failed" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("网络连接失败，请重试", "UNAUTHORIZED")
      })
    })

    it("应该正确处理 NETWORK_ERROR 代码", async () => {
      const error = { code: "NETWORK_ERROR", message: "Connection failed" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("网络连接失败，请重试", "UNAUTHORIZED")
      })
    })
  })

  describe("验证错误处理", () => {
    it("应该正确处理验证失败消息错误", async () => {
      const error = { message: "验证失败" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("输入信息有误，请检查后重试", "UNAUTHORIZED")
      })
    })

    it("应该正确处理 HTTP 400 错误", async () => {
      const error = { status: 400, message: "Bad Request" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("输入信息有误，请检查后重试", "UNAUTHORIZED")
      })
    })
  })

  describe("旧 AuthErrorType 兼容性", () => {
    it("应该正确处理 SESSION_EXPIRED 类型", async () => {
      const error = { type: "SESSION_EXPIRED", message: "Session expired" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("您的登录已过期，请重新登录", "SESSION_EXPIRED")
      })
    })

    it("应该正确处理 TOKEN_INVALID 类型", async () => {
      const error = { type: "TOKEN_INVALID", message: "Token invalid" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("登录信息无效，请重新登录", "INVALID_TOKEN")
      })
    })

    it("应该正确处理 INSUFFICIENT_PERMISSIONS 类型", async () => {
      const error = { type: "INSUFFICIENT_PERMISSIONS", message: "No permission" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("权限不足，无法执行此操作", "FORBIDDEN")
      })
    })

    it("应该正确处理 NETWORK_ERROR 类型", async () => {
      const error = { type: "NETWORK_ERROR", message: "Network failure" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("网络连接失败，请重试", "UNAUTHORIZED")
      })
    })

    it("应该正确处理 VALIDATION_ERROR 类型", async () => {
      const error = { type: "VALIDATION_ERROR", message: "Validation failed" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("输入信息有误，请检查后重试", "UNAUTHORIZED")
      })
    })

    it("应该正确处理 USER_NOT_FOUND 类型", async () => {
      const error = { type: "USER_NOT_FOUND", message: "User not found" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("用户不存在", "UNAUTHORIZED")
      })
    })

    it("应该正确处理 INVALID_CREDENTIALS 类型", async () => {
      const error = { type: "INVALID_CREDENTIALS", message: "Invalid credentials" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("用户名或密码错误", "INVALID_CREDENTIALS")
      })
    })

    it("应该正确处理 EMAIL_ALREADY_REGISTERED 类型", async () => {
      const error = { type: "EMAIL_ALREADY_REGISTERED", message: "Email exists" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("邮箱已被注册", "UNAUTHORIZED")
      })
    })

    it("应该正确处理 GITHUB_AUTH_FAILED 类型", async () => {
      const error = { type: "GITHUB_AUTH_FAILED", message: "GitHub auth failed" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("GitHub 登录失败", "UNAUTHORIZED")
      })
    })
  })

  describe("中文消息检测", () => {
    it("应该正确处理中文会话过期消息", async () => {
      const error = { message: "会话已过期，请重新登录" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("您的登录已过期，请重新登录", "SESSION_EXPIRED")
      })
    })

    it("应该正确处理中文令牌无效消息", async () => {
      const error = { message: "认证令牌无效" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("登录信息无效，请重新登录", "INVALID_TOKEN")
      })
    })

    it("应该正确处理用户名或密码错误消息", async () => {
      const error = { message: "用户名或密码错误" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("用户名或密码错误", "INVALID_CREDENTIALS")
      })
    })
  })

  describe("默认情况处理", () => {
    it("应该正确处理未知错误类型", async () => {
      const error = { message: "Some unknown error" }

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("Some unknown error", "UNAUTHORIZED")
      })
    })

    it("应该正确处理空错误对象", async () => {
      const error = {}

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("操作失败，请稍后重试", "UNAUTHORIZED")
      })
    })

    it("应该正确处理 null 错误", async () => {
      const error = null

      render(<TestComponent error={error} />)

      await waitFor(() => {
        expect(AuthError).toHaveBeenCalledWith("操作失败，请稍后重试", "UNAUTHORIZED")
      })
    })
  })

  describe("新AuthError兼容性", () => {
    it("应该直接使用已存在的 AuthError", async () => {
      const existingAuthError = new (AuthError as any)("Existing error", "FORBIDDEN")
      // Mock isAuthError to return true for this case
      const { isAuthError } = await import("@/lib/error-handling/auth-error")
      vi.mocked(isAuthError).mockReturnValueOnce(true)

      render(<TestComponent error={existingAuthError} />)

      await waitFor(() => {
        // Should not create new AuthError
        expect(AuthError).toHaveBeenCalledTimes(1) // Only from the setup above
      })
    })
  })
})
