import type { PerformanceStats } from "@/lib/performance-monitor"

/**
 * 监控仪表盘聚合统计
 */
export interface MonitoringStats {
  users: number
  posts: number
  comments: number
  activities: number
  generatedAt: string
  uptime?: number
}

/**
 * Supabase admin_dashboard_counters 行类型
 */
export interface AdminDashboardCounterRow {
  id: number
  users_count: number
  posts_count: number
  comments_count: number
  activities_count: number
  updated_at: string
}

/**
 * 性能报告结构（与 performanceMonitor.getPerformanceReport 保持一致）
 */
export interface PerformanceReport {
  summary: {
    totalRequests: number
    averageResponseTime: number
    errorRate: number
    slowRequestsRate: number
  }
  authMetrics: {
    loginTime: PerformanceStats
    sessionCheckTime: PerformanceStats
    permissionCheckTime: PerformanceStats
  }
  topSlowEndpoints: Array<{
    endpoint: string
    averageTime: number
    requestCount: number
  }>
  errorBreakdown: Array<{
    type: string
    count: number
    percentage: number
  }>
}

/**
 * 监控 API 返回结构：保持旧字段不变，追加性能报告
 */
export type MonitoringResponse = MonitoringStats & {
  performanceReport?: PerformanceReport | null
}
