'use client'

import React, { useState, useEffect } from 'react'
import MusicPlayer from './MusicPlayer'
import FloatingMusicControl from './FloatingMusicControl'

// 全局播放控制函数
let globalTogglePlay: (() => void) | null = null
let globalCurrentSong: { title: string; artist: string } | null = null

const MusicButton: React.FC = () => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSong, setCurrentSong] = useState<{ title: string; artist: string } | null>(null)
  const [mounted, setMounted] = useState(false)

  // 播放状态回调
  const handlePlayingChange = (playing: boolean) => {
    setIsPlaying(playing)
  }

  // 当前歌曲回调
  const handleCurrentSongChange = (song: { title: string; artist: string } | null) => {
    setCurrentSong(song)
    globalCurrentSong = song
  }

  // 全局播放控制
  const handleGlobalTogglePlay = () => {
    if (globalTogglePlay) {
      globalTogglePlay()
    }
  }

  // 确保组件在客户端挂载后再渲染
  useEffect(() => {
    setMounted(true)
  }, [])

  // 切换播放器显示状态
  const togglePlayer = () => {
    setIsPlayerOpen(!isPlayerOpen)
  }

  // 关闭播放器
  const closePlayer = () => {
    setIsPlayerOpen(false)
  }

  // 处理点击外部区域关闭播放器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (isPlayerOpen && !target.closest('.music-player-container')) {
        setIsPlayerOpen(false)
      }
    }

    if (isPlayerOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isPlayerOpen])

  // 防止服务端渲染不匹配
  if (!mounted) {
    return (
      <div className="flex items-center">
        <button
          className="hover:text-primary-500 dark:hover:text-primary-400 p-2 text-gray-900 dark:text-gray-100"
          aria-label="音乐播放器"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="music-player-container relative">
      {/* 音乐按钮 */}
      <button
        onClick={togglePlayer}
        className={`hover:text-primary-500 dark:hover:text-primary-400 p-2 text-gray-900 transition-colors duration-200 dark:text-gray-100 ${
          isPlayerOpen ? 'text-primary-500 dark:text-primary-400' : ''
        }`}
        aria-label="音乐播放器"
        aria-expanded={isPlayerOpen}
      >
        <div className="relative">
          {/* 音乐图标 */}
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>

          {/* 播放状态指示器 */}
          {isPlaying && (
            <div className="absolute -top-1 -right-1">
              <div className="h-3 w-3 animate-pulse rounded-full bg-green-500">
                <div className="absolute h-3 w-3 animate-ping rounded-full bg-green-500"></div>
              </div>
            </div>
          )}
        </div>
      </button>

      {/* 音乐播放器面板 */}
      <MusicPlayer
        isOpen={isPlayerOpen}
        onClose={closePlayer}
        onPlayingChange={handlePlayingChange}
        onCurrentSongChange={handleCurrentSongChange}
        onTogglePlayChange={(toggleFn) => {
          globalTogglePlay = toggleFn
        }}
      />

      {/* 浮动音乐控制器 */}
      {mounted && (
        <FloatingMusicControl
          isPlaying={isPlaying}
          onTogglePlay={handleGlobalTogglePlay}
          currentSong={currentSong}
        />
      )}
    </div>
  )
}

export default MusicButton
