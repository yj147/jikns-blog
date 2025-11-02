/**
 * EventEmitter 全局配置优化
 * 解决 Node.js EventEmitter 内存泄漏警告
 */

import { EventEmitter } from "events"

// 全局配置 EventEmitter 最大监听器数量
EventEmitter.defaultMaxListeners = 50

// 在开发环境中进一步优化
if (process.env.NODE_ENV === "development") {
  // 设置更高的限制，因为开发环境有热重载等额外的监听器
  EventEmitter.defaultMaxListeners = 100

  // 监听进程退出事件，清理监听器
  const cleanupListeners = () => {
    // 移除所有 beforeExit 监听器，避免累积
    process.removeAllListeners("beforeExit")
    // 移除其他可能累积的监听器
    process.removeAllListeners("exit")
    process.removeAllListeners("SIGINT")
    process.removeAllListeners("SIGTERM")
  }

  // 监听热重载相关事件
  if (typeof window === "undefined" && process.env.NEXT_PHASE === "phase-development-server") {
    // 防止热重载时监听器累积
    process.setMaxListeners(100)

    // 清理现有的退出监听器
    cleanupListeners()

    // 重新设置必要的清理监听器
    process.once("beforeExit", cleanupListeners)
    process.once("exit", cleanupListeners)
  }
}

// 导出配置函数，在需要时手动调用
export function configureEventEmitters() {
  // 设置全局 EventEmitter 配置
  EventEmitter.defaultMaxListeners = process.env.NODE_ENV === "development" ? 100 : 50

  // 设置进程的最大监听器数量
  process.setMaxListeners(process.env.NODE_ENV === "development" ? 100 : 50)
}

// 用于调试的辅助函数
export function debugEventListeners() {
  if (process.env.NODE_ENV === "development") {
    console.log("Current EventEmitter defaultMaxListeners:", EventEmitter.defaultMaxListeners)
    console.log("Current process maxListeners:", process.getMaxListeners())
    console.log("Process listeners count:", {
      beforeExit: process.listenerCount("beforeExit"),
      exit: process.listenerCount("exit"),
      SIGINT: process.listenerCount("SIGINT"),
      SIGTERM: process.listenerCount("SIGTERM"),
    })
  }
}

// 自动执行配置
configureEventEmitters()

export default {
  configureEventEmitters,
  debugEventListeners,
}
