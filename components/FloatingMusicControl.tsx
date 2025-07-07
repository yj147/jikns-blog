'use client'

import React, { useState, useEffect, useCallback } from 'react'

interface FloatingMusicControlProps {
  isPlaying: boolean
  onTogglePlay: () => void
  currentSong?: {
    title: string
    artist: string
  } | null
}

const FloatingMusicControl: React.FC<FloatingMusicControlProps> = ({
  isPlaying,
  onTogglePlay,
  currentSong,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isInitialized, setIsInitialized] = useState(false)
  const [clickStartPos, setClickStartPos] = useState({ x: 0, y: 0 })
  const [hasMoved, setHasMoved] = useState(false)

  // 初始化位置
  useEffect(() => {
    const initializePosition = () => {
      const elementSize = window.innerWidth < 768 ? 50 : 56 // 移动端更小
      const margin = 20

      // 检测现有的固定按钮位置，避免冲突
      // 右下角有目录按钮等 (right-4 bottom-4)
      const rightBottomOccupied = true

      // 计算多个可选位置
      const positions = [
        // 左下角
        { x: margin, y: window.innerHeight - elementSize - margin - 60 },
        // 左中
        { x: margin, y: window.innerHeight / 2 - elementSize / 2 },
        // 右中 (避开右下角按钮)
        {
          x: window.innerWidth - elementSize - margin,
          y: window.innerHeight / 2 - elementSize / 2 - 100,
        },
        // 左上
        { x: margin, y: margin + 100 }, // 避开顶部导航
      ]

      // 选择第一个可用位置（左下角）
      const selectedPosition = positions[0]

      setPosition({
        x: Math.max(margin, Math.min(selectedPosition.x, window.innerWidth - elementSize - margin)),
        y: Math.max(
          margin,
          Math.min(selectedPosition.y, window.innerHeight - elementSize - margin)
        ),
      })
      setIsInitialized(true)
    }

    // 延迟初始化，确保DOM已加载
    const timer = setTimeout(initializePosition, 100)

    // 监听窗口大小变化
    window.addEventListener('resize', initializePosition)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', initializePosition)
    }
  }, [])

  // 检测滚动，显示/隐藏浮动控制器
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      // 滚动超过200px时显示浮动控制器
      setIsVisible(scrollY > 200 && isInitialized)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isInitialized])

  // 拖拽功能
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // 只处理左键

    const rect = e.currentTarget.getBoundingClientRect()

    // 计算鼠标相对于元素的偏移
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top

    setDragOffset({ x: offsetX, y: offsetY })
    setIsDragging(true)

    // 禁用浏览器默认的拖拽行为
    e.preventDefault()
    e.stopPropagation()

    // 禁用文本选择和图像拖拽
    document.body.classList.add('dragging-music-control')
  }

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      // 计算新位置：鼠标位置减去偏移量
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y

      // 获取元素尺寸（响应式）
      const elementSize = window.innerWidth < 768 ? 50 : 56

      // 限制在视窗范围内
      const maxX = window.innerWidth - elementSize
      const maxY = window.innerHeight - elementSize

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })
    },
    [isDragging, dragOffset.x, dragOffset.y, setPosition]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)

    // 恢复文本选择
    document.body.classList.remove('dragging-music-control')
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    const rect = e.currentTarget.getBoundingClientRect()

    const offsetX = touch.clientX - rect.left
    const offsetY = touch.clientY - rect.top

    setDragOffset({ x: offsetX, y: offsetY })
    setClickStartPos({ x: touch.clientX, y: touch.clientY })
    setHasMoved(false)
    setIsDragging(true)

    // 不在这里调用 preventDefault，而是在全局事件监听器中处理
  }

  const handleTouchMove = React.useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return

      const touch = e.touches[0]
      const newX = touch.clientX - dragOffset.x
      const newY = touch.clientY - dragOffset.y

      const elementSize = window.innerWidth < 768 ? 50 : 56
      const maxX = window.innerWidth - elementSize
      const maxY = window.innerHeight - elementSize

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      })

      // 检查是否移动了足够距离
      const moveDistance = Math.sqrt(
        Math.pow(touch.clientX - clickStartPos.x, 2) + Math.pow(touch.clientY - clickStartPos.y, 2)
      )
      if (moveDistance > 5) {
        setHasMoved(true)
      }

      // 移除 preventDefault，避免被动事件监听器警告
    },
    [
      isDragging,
      dragOffset.x,
      dragOffset.y,
      setPosition,
      clickStartPos.x,
      clickStartPos.y,
      setHasMoved,
    ]
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)

    // 恢复文本选择
    document.body.classList.remove('dragging-music-control')
  }, [])

  useEffect(() => {
    if (isDragging) {
      // 添加全局事件监听器，明确设置为非被动模式
      const handleGlobalMouseMove = (e: MouseEvent) => {
        handleMouseMove(e)
      }

      const handleGlobalTouchMove = (e: TouchEvent) => {
        e.preventDefault() // 在这里安全地调用 preventDefault
        handleTouchMove(e)
      }

      document.addEventListener('mousemove', handleGlobalMouseMove, { passive: false })
      document.addEventListener('mouseup', handleMouseUp, { passive: false })
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd, { passive: false })

      // 防止页面滚动和选择文本
      document.body.classList.add('dragging-music-control')

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleGlobalTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)

        // 恢复页面状态
        document.body.classList.remove('dragging-music-control')
      }
    }
  }, [
    isDragging,
    dragOffset.x,
    dragOffset.y,
    handleMouseMove,
    handleTouchMove,
    handleMouseUp,
    handleTouchEnd,
  ])

  // 点击处理（区分拖拽和点击）
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()

    // 如果鼠标移动距离很小，认为是点击而不是拖拽
    const moveDistance = Math.sqrt(
      Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2)
    )

    // 移动距离小于5px认为是点击
    if (moveDistance < 5 && !hasMoved) {
      onTogglePlay()
    }
  }

  // 记录点击开始位置
  const handleMouseDownClick = (e: React.MouseEvent) => {
    setClickStartPos({ x: e.clientX, y: e.clientY })
    setHasMoved(false)
    handleMouseDown(e)
  }

  // 监听鼠标移动来判断是否为拖拽
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const moveDistance = Math.sqrt(
          Math.pow(e.clientX - clickStartPos.x, 2) + Math.pow(e.clientY - clickStartPos.y, 2)
        )
        if (moveDistance > 5) {
          setHasMoved(true)
        }
      }
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      return () => document.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [isDragging, clickStartPos])

  // 如果没有当前歌曲或未初始化，不显示控制器
  if (!currentSong || !isInitialized) return null

  // 调试信息（开发环境）
  const isDebug = process.env.NODE_ENV === 'development'

  return (
    <>
      {/* 浮动音乐控制器 */}
      <button
        type="button"
        aria-label={isPlaying ? '暂停音乐' : '播放音乐'}
        className={`floating-music-control fixed ${
          isDragging ? 'dragging z-[9999]' : 'z-[45] transition-all duration-300'
        } ${isVisible ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}
        onMouseDown={handleMouseDownClick}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          // 确保在移动端可见
          minWidth: '50px',
          minHeight: '50px',
          // 禁用浏览器默认拖拽
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        <div className="group relative">
          {/* 主控制按钮 */}
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-white sm:h-14 sm:w-14 md:h-14 md:w-14 dark:bg-gray-800 ${
              isDragging
                ? 'border-none shadow-none'
                : 'border border-gray-200 shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl dark:border-gray-700'
            }`}
          >
            {isPlaying ? (
              <div className="relative">
                {/* 旋转的音乐图标 */}
                <svg
                  className="text-primary-600 dark:text-primary-400 h-6 w-6 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ animationDuration: '3s' }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                {/* 播放指示器 - 拖拽时隐藏 */}
                {!isDragging && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-green-500">
                    <div className="absolute h-3 w-3 animate-ping rounded-full bg-green-500"></div>
                  </div>
                )}
              </div>
            ) : (
              <svg
                className="h-6 w-6 text-gray-600 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            )}
          </div>
        </div>
      </button>
    </>
  )
}

export default FloatingMusicControl
