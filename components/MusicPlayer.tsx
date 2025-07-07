'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Song,
  getDefaultSong,
  getNextSong,
  getPrevSong,
  musicPlayerConfig,
  fetchMusicList,
  type MusicApiResponse,
} from '@/data/musicData'

// 全局音频实例，确保音乐播放的持续性
let globalAudio: HTMLAudioElement | null = null
let globalPlaylist: Song[] = []
let globalCurrentSong: Song | null = null
let globalIsPlaying = false

interface MusicPlayerProps {
  isOpen: boolean
  onClose: () => void
  onPlayingChange?: (isPlaying: boolean) => void
  onCurrentSongChange?: (song: { title: string; artist: string } | null) => void
  onTogglePlayChange?: (toggleFn: () => void) => void
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({
  isOpen,
  onClose,
  onPlayingChange,
  onCurrentSongChange,
  onTogglePlayChange,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playlist, setPlaylist] = useState<Song[]>(globalPlaylist)
  const [currentSong, setCurrentSong] = useState<Song | null>(globalCurrentSong)
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(musicPlayerConfig.defaultVolume)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPlaylist, setIsLoadingPlaylist] = useState(!globalPlaylist.length)
  const [playlistError, setPlaylistError] = useState<string | null>(null)

  // 初始化全局音频
  useEffect(() => {
    if (!globalAudio) {
      globalAudio = new Audio()
      globalAudio.volume = musicPlayerConfig.defaultVolume
    }

    // 同步全局状态到组件状态
    setPlaylist(globalPlaylist)
    setCurrentSong(globalCurrentSong)
    setIsPlaying(globalIsPlaying)

    if (globalAudio && globalCurrentSong) {
      setCurrentTime(globalAudio.currentTime)
      setDuration(globalAudio.duration || 0)
    }
  }, [])

  // 更新播放状态到父组件
  useEffect(() => {
    onPlayingChange?.(isPlaying)
  }, [isPlaying, onPlayingChange])

  // 更新当前歌曲到父组件
  // 播放/暂停
  const togglePlay = useCallback(async () => {
    if (!globalAudio) return

    try {
      if (isPlaying) {
        globalAudio.pause()
        globalIsPlaying = false
        setIsPlaying(false)
      } else {
        await globalAudio.play()
        globalIsPlaying = true
        setIsPlaying(true)
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('播放失败:', error)
      }
      globalIsPlaying = false
      setIsPlaying(false)
    }
  }, [isPlaying])

  // 下一首
  const handleNext = useCallback(() => {
    if (!currentSong || playlist.length === 0) return

    const nextSong = getNextSong(currentSong.id, playlist)
    if (nextSong && globalAudio) {
      globalCurrentSong = nextSong
      globalAudio.src = nextSong.src
      setCurrentSong(nextSong)
      globalIsPlaying = false
      setIsPlaying(false)
    }
  }, [currentSong, playlist])

  useEffect(() => {
    onCurrentSongChange?.(currentSong)
  }, [currentSong, onCurrentSongChange])

  // 注册全局播放控制函数
  useEffect(() => {
    onTogglePlayChange?.(togglePlay)
  }, [onTogglePlayChange, togglePlay])

  // 加载播放列表
  useEffect(() => {
    const loadPlaylist = async () => {
      // 如果全局播放列表已存在，不需要重新加载
      if (globalPlaylist.length > 0) {
        setIsLoadingPlaylist(false)
        return
      }

      setIsLoadingPlaylist(true)
      setPlaylistError(null)

      try {
        const response: MusicApiResponse = await fetchMusicList()

        if (response.success && response.songs.length > 0) {
          globalPlaylist = response.songs
          globalCurrentSong = response.songs[0]
          setPlaylist(response.songs)
          setCurrentSong(response.songs[0])

          // 设置全局音频源
          if (globalAudio && globalCurrentSong) {
            globalAudio.src = globalCurrentSong.src
          }
        } else {
          // 如果没有找到音乐文件，使用默认歌曲
          const defaultSong = getDefaultSong()
          if (defaultSong) {
            globalPlaylist = [defaultSong]
            globalCurrentSong = defaultSong
            setPlaylist([defaultSong])
            setCurrentSong(defaultSong)

            if (globalAudio) {
              globalAudio.src = defaultSong.src
            }
          } else {
            setPlaylistError('未找到音乐文件，请在 public/static/music/ 目录下添加音频文件')
          }
        }
      } catch (error) {
        console.error('加载播放列表失败:', error)
        setPlaylistError('加载播放列表失败，请检查网络连接')

        // 尝试使用默认歌曲作为后备
        const defaultSong = getDefaultSong()
        if (defaultSong) {
          globalPlaylist = [defaultSong]
          globalCurrentSong = defaultSong
          setPlaylist([defaultSong])
          setCurrentSong(defaultSong)

          if (globalAudio) {
            globalAudio.src = defaultSong.src
          }
        }
      } finally {
        setIsLoadingPlaylist(false)
      }
    }

    if (isOpen) {
      loadPlaylist()
    }
  }, [isOpen])

  // 音频事件处理
  useEffect(() => {
    if (!globalAudio || !currentSong) return

    const handleTimeUpdate = () => setCurrentTime(globalAudio!.currentTime)
    const handleDurationChange = () => setDuration(globalAudio!.duration)
    const handleLoadStart = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)
    const handleEnded = () => {
      globalIsPlaying = false
      setIsPlaying(false)
      if (musicPlayerConfig.autoNext) {
        handleNext()
      }
    }

    globalAudio.addEventListener('timeupdate', handleTimeUpdate)
    globalAudio.addEventListener('durationchange', handleDurationChange)
    globalAudio.addEventListener('loadstart', handleLoadStart)
    globalAudio.addEventListener('canplay', handleCanPlay)
    globalAudio.addEventListener('ended', handleEnded)

    return () => {
      if (globalAudio) {
        globalAudio.removeEventListener('timeupdate', handleTimeUpdate)
        globalAudio.removeEventListener('durationchange', handleDurationChange)
        globalAudio.removeEventListener('loadstart', handleLoadStart)
        globalAudio.removeEventListener('canplay', handleCanPlay)
        globalAudio.removeEventListener('ended', handleEnded)
      }
    }
  }, [currentSong, handleNext])

  // 音量控制
  useEffect(() => {
    if (globalAudio) {
      globalAudio.volume = volume
    }
  }, [volume])

  // 上一首
  const handlePrev = useCallback(() => {
    if (!currentSong || playlist.length === 0) return

    const prevSong = getPrevSong(currentSong.id, playlist)
    if (prevSong && globalAudio) {
      globalCurrentSong = prevSong
      globalAudio.src = prevSong.src
      setCurrentSong(prevSong)
      globalIsPlaying = false
      setIsPlaying(false)
    }
  }, [currentSong, playlist])

  // 进度条拖拽
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!globalAudio) return

    const newTime = parseFloat(e.target.value)
    globalAudio.currentTime = newTime
    setCurrentTime(newTime)
  }

  // 格式化时间
  const formatTime = (time: number): string => {
    if (isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
      {/* 注意：我们使用全局音频实例，不需要在这里渲染audio元素 */}

      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">音乐播放器</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {isLoadingPlaylist ? (
          <div className="py-8 text-center">
            <div className="border-primary-600 mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">正在加载音乐列表...</p>
          </div>
        ) : playlistError ? (
          <div className="py-8 text-center">
            <div className="mb-2 text-red-500">
              <svg
                className="mx-auto h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{playlistError}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-2 text-xs"
            >
              重新加载
            </button>
          </div>
        ) : !currentSong ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">暂无可播放的音乐</p>
          </div>
        ) : (
          <>
            {/* 歌曲信息 */}
            <div className="mb-4 text-center">
              <h4 className="truncate text-lg font-medium text-gray-900 dark:text-white">
                {currentSong.title}
              </h4>
              <p className="truncate text-sm text-gray-600 dark:text-gray-400">
                {currentSong.artist}
              </p>
              {playlist.length > 1 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  {playlist.findIndex((s) => s.id === currentSong.id) + 1} / {playlist.length}
                </p>
              )}
            </div>

            {/* 进度条 */}
            <div className="mb-4">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="mb-4 flex items-center justify-center space-x-4">
              <button
                onClick={handlePrev}
                disabled={playlist.length <= 1}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="bg-primary-600 hover:bg-primary-700 rounded-full p-3 text-white disabled:opacity-50"
              >
                {isLoading ? (
                  <svg className="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                ) : isPlaying ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 9v6m4-6v6"
                    />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15"
                    />
                  </svg>
                )}
              </button>

              <button
                onClick={handleNext}
                disabled={playlist.length <= 1}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-white"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* 音量控制 */}
            <div className="flex items-center space-x-2">
              <svg
                className="h-4 w-4 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M6 10H4a2 2 0 00-2 2v0a2 2 0 002 2h2l4 4V6l-4 4z"
                />
              </svg>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-gray-200 dark:bg-gray-700"
              />
              <span className="w-8 text-xs text-gray-500 dark:text-gray-400">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MusicPlayer
