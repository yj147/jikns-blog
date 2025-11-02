/**
 * 重试管理器 - 实现指数退让和策略化重试
 * Phase 5: 前端错误处理与用户体验优化
 */

import { RetryStrategy } from "@/types/error"

interface RetryState {
  operationId: string
  attempts: number
  lastAttempt: number
  nextRetryAfter: number
  strategy: RetryStrategy
}

class RetryManager {
  private retryStates = new Map<string, RetryState>()
  private timers = new Map<string, NodeJS.Timeout>()

  /**
   * 执行带重试的操作
   */
  async retry<T>(
    operation: () => Promise<T>,
    strategy: RetryStrategy,
    operationId: string = this.generateOperationId()
  ): Promise<T> {
    const state: RetryState = {
      operationId,
      attempts: 0,
      lastAttempt: 0,
      nextRetryAfter: 0,
      strategy,
    }

    this.retryStates.set(operationId, state)

    try {
      return await this.executeWithRetry(operation, state)
    } finally {
      // 清理状态
      this.retryStates.delete(operationId)
      const timer = this.timers.get(operationId)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(operationId)
      }
    }
  }

  /**
   * 取消指定操作的重试
   */
  cancelRetry(operationId: string): boolean {
    const timer = this.timers.get(operationId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(operationId)
      this.retryStates.delete(operationId)
      return true
    }
    return false
  }

  /**
   * 获取操作的重试状态
   */
  getRetryState(operationId: string): RetryState | undefined {
    return this.retryStates.get(operationId)
  }

  /**
   * 获取所有活跃的重试状态
   */
  getActiveRetries(): RetryState[] {
    return Array.from(this.retryStates.values())
  }

  /**
   * 清除所有重试状态
   */
  clearAll(): void {
    // 取消所有计时器
    this.timers.forEach((timer) => clearTimeout(timer))
    this.timers.clear()
    this.retryStates.clear()
  }

  /**
   * 执行带重试的操作
   */
  private async executeWithRetry<T>(operation: () => Promise<T>, state: RetryState): Promise<T> {
    while (state.attempts <= state.strategy.maxRetries) {
      try {
        state.attempts++
        state.lastAttempt = Date.now()

        const result = await operation()
        return result
      } catch (error) {
        // 如果达到最大重试次数，抛出错误
        if (state.attempts >= state.strategy.maxRetries) {
          throw error
        }

        // 计算下次重试的延迟时间
        const delay = this.calculateDelay(state)
        state.nextRetryAfter = Date.now() + delay

        // 等待指定时间后重试
        await this.waitForRetry(delay, state.operationId)
      }
    }

    // 这里不会被执行，但为了 TypeScript 类型检查
    throw new Error("重试超过最大次数")
  }

  /**
   * 计算重试延迟时间
   */
  private calculateDelay(state: RetryState): number {
    const { strategy, attempts } = state
    let delay = strategy.baseDelay

    // 指数退让
    if (strategy.exponentialBackoff) {
      delay = Math.min(strategy.baseDelay * Math.pow(2, attempts - 1), strategy.maxDelay)
    }

    // 添加随机抖动，避免雷群效应
    if (strategy.jitter) {
      const jitterAmount = delay * 0.1 // 10% 的随机抖动
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount
      delay = Math.max(0, delay + jitter)
    }

    return Math.min(delay, strategy.maxDelay)
  }

  /**
   * 等待重试
   */
  private waitForRetry(delay: number, operationId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.timers.delete(operationId)
        resolve()
      }, delay)

      this.timers.set(operationId, timer)

      // 允许进程退出而不等待这个 timer
      timer.unref()
    })
  }

  /**
   * 生成操作 ID
   */
  private generateOperationId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

export default RetryManager
