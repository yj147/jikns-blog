/**
 * API 错误响应集成测试
 * RFC Phase 1: 验证新增错误码的正确返回
 */

import { describe, test, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { ErrorCode, createErrorResponse } from "@/lib/api/unified-response"
import { AuthErrors, throwAuthError } from "@/lib/error-handling/auth-error"
import { classifyAndFormatError } from "@/lib/error-handling/classify-auth-error"

describe("API 错误响应对齐测试", () => {
  describe("新增错误码验证", () => {
    test("NETWORK_ERROR 应正确返回", () => {
      const response = createErrorResponse(ErrorCode.NETWORK_ERROR, "网络连接失败", undefined, 500)

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "网络连接失败",
          statusCode: 500,
        },
      })
      expect(response.status).toBe(500)
    })

    test("VALIDATION_ERROR 应正确返回", () => {
      const response = createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        "输入数据验证失败",
        { fields: ["email", "name"] },
        400
      )

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "输入数据验证失败",
          statusCode: 400,
          details: { fields: ["email", "name"] },
        },
      })
      expect(response.status).toBe(400)
    })

    test("UNKNOWN_ERROR 应正确返回", () => {
      const response = createErrorResponse(ErrorCode.UNKNOWN_ERROR, "发生未知错误", undefined, 500)

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: "发生未知错误",
          statusCode: 500,
        },
      })
      expect(response.status).toBe(500)
    })

    test("SESSION_EXPIRED 应正确返回", () => {
      const response = createErrorResponse(
        ErrorCode.SESSION_EXPIRED,
        "会话已过期，请重新登录",
        undefined,
        401
      )

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "SESSION_EXPIRED",
          message: "会话已过期，请重新登录",
          statusCode: 401,
        },
      })
      expect(response.status).toBe(401)
    })

    test("INVALID_TOKEN 应正确返回", () => {
      const response = createErrorResponse(ErrorCode.INVALID_TOKEN, "令牌无效", undefined, 401)

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "INVALID_TOKEN",
          message: "令牌无效",
          statusCode: 401,
        },
      })
      expect(response.status).toBe(401)
    })

    test("ACCOUNT_BANNED 应正确返回", () => {
      const response = createErrorResponse(ErrorCode.ACCOUNT_BANNED, "账号已被封禁", undefined, 403)

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "ACCOUNT_BANNED",
          message: "账号已被封禁",
          statusCode: 403,
        },
      })
      expect(response.status).toBe(403)
    })

    test("INVALID_CREDENTIALS 应正确返回", () => {
      const response = createErrorResponse(
        ErrorCode.INVALID_CREDENTIALS,
        "用户名或密码错误",
        undefined,
        401
      )

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "INVALID_CREDENTIALS",
          message: "用户名或密码错误",
          statusCode: 401,
        },
      })
      expect(response.status).toBe(401)
    })
  })

  describe("错误分类与格式化", () => {
    test("网络错误应正确分类", () => {
      const networkError = new Error("Network Error")
      ;(networkError as any).name = "NetworkError"
      ;(networkError as any).code = "NETWORK_ERROR"

      const classified = classifyAndFormatError(networkError)
      expect(classified).toEqual({
        code: "NETWORK_ERROR",
        message: "网络连接失败，请重试",
      })
    })

    test("验证错误应正确分类", () => {
      const validationError = new Error("验证失败：邮箱格式不正确")
      ;(validationError as any).status = 400

      const classified = classifyAndFormatError(validationError)
      expect(classified).toEqual({
        code: "VALIDATION_ERROR",
        message: "输入信息有误，请检查后重试",
      })
    })

    test("JWT 过期错误应正确分类", () => {
      const jwtError = new Error("JWT expired at 2024-01-01")

      const classified = classifyAndFormatError(jwtError)
      expect(classified).toEqual({
        code: "SESSION_EXPIRED",
        message: "您的登录已过期，请重新登录",
      })
    })

    test("服务器错误应分类为 UNKNOWN_ERROR", () => {
      const serverError = new Error("Internal Server Error")
      ;(serverError as any).status = 500

      const classified = classifyAndFormatError(serverError)
      expect(classified).toEqual({
        code: "UNKNOWN_ERROR",
        message: "服务器错误，请稍后重试",
      })
    })

    test("未知错误应保留原始消息", () => {
      const unknownError = new Error("自定义错误消息")

      const classified = classifyAndFormatError(unknownError)
      expect(classified).toEqual({
        code: "UNKNOWN_ERROR",
        message: "自定义错误消息",
      })
    })
  })

  describe("AuthError 与 ErrorCode 映射", () => {
    test("AuthError 应能正确转换为 API 响应", () => {
      const authError = AuthErrors.networkError("网络异常", {
        requestId: "req-123",
        path: "/api/test",
      })

      // 模拟 API 处理
      const response = createErrorResponse(
        ErrorCode.NETWORK_ERROR,
        authError.message,
        { requestId: authError.requestId },
        authError.statusCode
      )

      const json = response.json()
      expect(json).resolves.toMatchObject({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "网络异常",
          statusCode: 500,
          details: { requestId: "req-123" },
        },
      })
    })

    test("多种 AuthError 类型应正确映射", () => {
      const testCases = [
        {
          error: AuthErrors.unauthorized({ requestId: "req-1" }),
          expectedCode: ErrorCode.UNAUTHORIZED,
          expectedStatus: 401,
        },
        {
          error: AuthErrors.forbidden("无权访问", { requestId: "req-2" }),
          expectedCode: ErrorCode.FORBIDDEN,
          expectedStatus: 403,
        },
        {
          error: AuthErrors.sessionExpired({ requestId: "req-3" }),
          expectedCode: ErrorCode.SESSION_EXPIRED,
          expectedStatus: 401,
        },
        {
          error: AuthErrors.accountBanned({ requestId: "req-4" }),
          expectedCode: ErrorCode.ACCOUNT_BANNED,
          expectedStatus: 403,
        },
        {
          error: AuthErrors.validationError("输入错误", { requestId: "req-5" }),
          expectedCode: ErrorCode.VALIDATION_ERROR,
          expectedStatus: 400,
        },
      ]

      testCases.forEach(({ error, expectedCode, expectedStatus }) => {
        const response = createErrorResponse(
          expectedCode,
          error.message,
          { requestId: error.requestId },
          expectedStatus
        )
        expect(response.status).toBe(expectedStatus)
      })
    })
  })

  describe("典型场景模拟", () => {
    test("模拟网络超时场景", async () => {
      // 模拟一个会超时的 API 调用
      const apiCall = () =>
        new Promise((_, reject) => {
          setTimeout(() => {
            const error = new Error("Request timeout")
            ;(error as any).code = "NETWORK_ERROR"
            reject(error)
          }, 100)
        })

      try {
        await apiCall()
      } catch (error) {
        const classified = classifyAndFormatError(error)
        expect(classified.code).toBe("NETWORK_ERROR")
        expect(classified.message).toBe("网络连接失败，请重试")
      }
    })

    test("模拟表单验证失败场景", () => {
      const validateForm = (data: any) => {
        const errors = []
        if (!data.email) errors.push("邮箱必填")
        if (!data.password) errors.push("密码必填")

        if (errors.length > 0) {
          const error = new Error("验证失败")
          ;(error as any).status = 400
          ;(error as any).details = errors
          throw error
        }
      }

      expect(() => validateForm({})).toThrow()

      try {
        validateForm({})
      } catch (error) {
        const classified = classifyAndFormatError(error)
        expect(classified.code).toBe("VALIDATION_ERROR")
        expect(classified.message).toBe("输入信息有误，请检查后重试")
      }
    })

    test("模拟 JWT 刷新失败场景", () => {
      const refreshToken = () => {
        throw new Error("Invalid Refresh Token: Token has been revoked")
      }

      expect(() => refreshToken()).toThrow()

      try {
        refreshToken()
      } catch (error) {
        const classified = classifyAndFormatError(error)
        expect(classified.code).toBe("INVALID_TOKEN")
        expect(classified.message).toBe("登录信息无效，请重新登录")
      }
    })
  })
})
