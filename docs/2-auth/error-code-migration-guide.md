# 认证错误码迁移指南

## 概述

本文档说明了认证系统 Phase 2 新增的错误码及其使用方式，并提供迁移指南。

## 新增错误码

### 1. NETWORK_ERROR (500)

**用途**: 网络连接或外部服务调用失败 **使用场景**:

- Supabase 连接失败
- 数据库连接超时
- 外部 API 调用失败

```typescript
import { AuthErrors } from "@/lib/error-handling/auth-error"

// 使用示例
try {
  const response = await fetch(apiUrl)
  if (!response.ok) {
    throw AuthErrors.networkError("外部服务不可用")
  }
} catch (error) {
  if (error.code === "ECONNREFUSED") {
    throw AuthErrors.networkError("无法连接到服务器")
  }
}
```

### 2. VALIDATION_ERROR (400)

**用途**: 请求数据验证失败 **使用场景**:

- 表单数据格式错误
- 必填字段缺失
- 数据类型不匹配

```typescript
// 使用示例
if (!email || !email.includes("@")) {
  throw AuthErrors.validationError("邮箱格式无效")
}

if (password.length < 8) {
  throw AuthErrors.validationError("密码长度至少8位")
}
```

### 3. UNKNOWN_ERROR (500)

**用途**: 未预期的系统错误 **使用场景**:

- 捕获未知异常
- 系统内部错误
- 兜底错误处理

```typescript
// 使用示例
try {
  // 复杂业务逻辑
} catch (error) {
  // 如果无法识别错误类型
  if (!isKnownError(error)) {
    throw AuthErrors.unknownError("系统处理异常，请稍后重试")
  }
}
```

## API 响应格式更新

### 标准错误响应结构

```typescript
{
  success: false,
  error: {
    code: "NETWORK_ERROR",  // 新增错误码
    message: "网络连接失败，请检查网络后重试"
  },
  requestId: "req_123456",
  timestamp: "2025-09-26T10:00:00Z"
}
```

### HTTP 状态码映射

| 错误码           | HTTP 状态码 | 说明               |
| ---------------- | ----------- | ------------------ |
| NETWORK_ERROR    | 500         | 网络或外部服务错误 |
| VALIDATION_ERROR | 400         | 请求数据验证失败   |
| UNKNOWN_ERROR    | 500         | 未知系统错误       |

## 迁移步骤

### 第一阶段：兼容性保持（当前阶段）

1. 新增错误码已添加到 `AuthErrorCode` 枚举
2. `AuthErrors` 工厂函数已支持新错误码
3. 旧代码继续正常工作，无需立即修改

### 第二阶段：逐步迁移（1-2周内）

1. **识别使用点**: 搜索所有使用通用错误处理的地方

```bash
grep -r "createErrorResponse\|new Error\|throw Error" --include="*.ts" --include="*.tsx"
```

2. **分类替换**: 根据错误场景选择合适的新错误码

```typescript
// 旧代码
throw new Error("网络错误")

// 新代码
throw AuthErrors.networkError("网络连接失败")
```

3. **测试验证**: 确保错误码正确传递到前端

### 第三阶段：清理优化（1个月内）

1. 移除旧的通用错误处理代码
2. 统一使用 `AuthError` 类和相关工厂函数
3. 更新所有文档和测试

## 前端消费指南

### 错误处理示例

```typescript
// hooks/use-error-handler.ts
import { AuthErrorCode } from "@/lib/error-handling/auth-error"

export function handleAuthError(error: any) {
  switch (error.code as AuthErrorCode) {
    case "NETWORK_ERROR":
      toast.error("网络连接失败，请检查网络设置")
      break
    case "VALIDATION_ERROR":
      toast.warning("请检查输入数据")
      break
    case "UNKNOWN_ERROR":
      toast.error("系统异常，请稍后重试")
      break
    // ... 其他错误码处理
  }
}
```

### Toast 消息映射

```typescript
const errorMessages: Record<AuthErrorCode, string> = {
  NETWORK_ERROR: "网络连接失败，请检查网络后重试",
  VALIDATION_ERROR: "输入数据验证失败，请检查表单",
  UNKNOWN_ERROR: "发生未知错误，请联系管理员",
  // ... 其他错误消息
}
```

## 监控和日志

### 错误监控

所有新错误码都会自动记录到认证审计日志：

```typescript
// 自动记录的字段
{
  errorCode: "NETWORK_ERROR",
  errorMessage: "具体错误信息",
  requestId: "req_xxx",
  timestamp: "2025-09-26T10:00:00Z",
  path: "/api/xxx",
  ip: "xxx.xxx.xxx.xxx"
}
```

### 错误统计

可通过以下方式查询错误分布：

```sql
SELECT
  error_code,
  COUNT(*) as count,
  DATE(timestamp) as date
FROM auth_audit_logs
WHERE event = 'auth_failure'
GROUP BY error_code, DATE(timestamp)
ORDER BY date DESC, count DESC
```

## 向后兼容性

### 保留的旧错误码

以下旧错误码将在过渡期内保留，但建议逐步迁移：

- `AUTHENTICATION_REQUIRED` → 使用 `UNAUTHORIZED`
- `INSUFFICIENT_PERMISSIONS` → 使用 `FORBIDDEN`

### 兼容性承诺

- 新错误码不影响现有功能
- 旧代码继续正常工作
- 提供平滑的迁移路径

## 常见问题

### Q: 何时使用 NETWORK_ERROR vs UNKNOWN_ERROR？

A: 如果明确是网络/外部服务问题，使用 NETWORK_ERROR；无法判断原因时使用 UNKNOWN_ERROR。

### Q: VALIDATION_ERROR 是否包含详细字段信息？

A: 可以在错误消息中包含字段名，或在 context 中传递详细信息。

### Q: 如何处理多个验证错误？

A: 可以将所有验证错误收集后，一次性返回：

```typescript
const errors = []
if (!email) errors.push("邮箱必填")
if (!password) errors.push("密码必填")
if (errors.length > 0) {
  throw AuthErrors.validationError(errors.join(", "))
}
```

## 联系支持

如有疑问或需要帮助，请联系认证系统团队。

---

文档版本: 1.0.0更新日期: 2025-09-26作者: 认证系统团队
