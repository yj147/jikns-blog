/**
 * FollowButton 错误提示组件
 * 负责显示错误消息
 */

interface FollowError {
  code?: string
  message?: string
  retryAfter?: number
}

interface FollowButtonErrorProps {
  error: FollowError | null
}

export function FollowButtonError({ error }: FollowButtonErrorProps) {
  if (!error) return null

  const getMessage = () => {
    switch (error.code) {
      case "RATE_LIMIT_EXCEEDED":
        return `操作过于频繁，请 ${error.retryAfter || 60} 秒后重试`
      case "UNAUTHORIZED":
        return "请先登录"
      case "FORBIDDEN":
        return "没有权限执行此操作"
      case "BUSY":
        return "关注操作处理中，请稍候"
      case "NETWORK_ERROR":
        return "网络连接失败，请检查网络设置"
      default:
        return error.message || "操作失败，请重试"
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="bg-destructive text-destructive-foreground absolute left-0 top-full z-10 mt-1 max-w-xs rounded-md px-2 py-1 text-xs shadow-lg"
    >
      {getMessage()}
    </div>
  )
}
