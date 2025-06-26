// 音乐播放列表配置
export interface Song {
  id: string
  title: string
  artist: string
  src: string
  duration?: number
  cover?: string
  filename?: string
  size?: number
  lastModified?: number
}

export interface Playlist {
  id: string
  name: string
  songs: Song[]
}

// API响应接口
export interface MusicApiResponse {
  success: boolean
  songs: Song[]
  total: number
  cached?: boolean
  cacheAge?: number
  scannedAt?: string
  error?: string
}

// 默认播放列表（作为后备）
export const defaultPlaylist: Playlist = {
  id: 'default',
  name: '我的音乐',
  songs: []
}

// 所有播放列表
export const playlists: Playlist[] = [defaultPlaylist]

// 音乐播放器配置
export const musicPlayerConfig = {
  // 默认音量 (0-1)
  defaultVolume: 0.7,
  // 是否自动播放下一首
  autoNext: true,
  // 是否循环播放
  loop: false,
  // 是否随机播放
  shuffle: false,
  // 淡入淡出时间(毫秒)
  fadeTime: 500,
}

// API调用函数
export async function fetchMusicList(forceRefresh = false): Promise<MusicApiResponse> {
  try {
    const url = `/api/music${forceRefresh ? '?refresh=true' : ''}`
    const response = await fetch(url)
    const data: MusicApiResponse = await response.json()

    if (!data.success) {
      throw new Error(data.error || '获取音乐列表失败')
    }

    return data
  } catch (error) {
    console.error('获取音乐列表失败:', error)
    return {
      success: false,
      songs: [],
      total: 0,
      error: error instanceof Error ? error.message : '网络错误'
    }
  }
}

// 刷新音乐缓存
export async function refreshMusicCache(): Promise<MusicApiResponse> {
  try {
    const response = await fetch('/api/music', {
      method: 'POST'
    })
    const data: MusicApiResponse = await response.json()

    if (!data.success) {
      throw new Error(data.error || '刷新缓存失败')
    }

    return data
  } catch (error) {
    console.error('刷新音乐缓存失败:', error)
    return {
      success: false,
      songs: [],
      total: 0,
      error: error instanceof Error ? error.message : '网络错误'
    }
  }
}

// 获取默认歌曲（支持动态列表）
export const getDefaultSong = (songs: Song[] = defaultPlaylist.songs): Song | null => {
  return songs.length > 0 ? songs[0] : null
}

// 根据ID查找歌曲（支持动态列表）
export const findSongById = (id: string, songs: Song[] = defaultPlaylist.songs): Song | undefined => {
  return songs.find(s => s.id === id)
}

// 获取下一首歌曲（支持动态列表）
export const getNextSong = (currentSongId: string, songs: Song[] = defaultPlaylist.songs): Song | null => {
  if (songs.length === 0) return null

  const currentIndex = songs.findIndex(s => s.id === currentSongId)
  if (currentIndex === -1) return null

  const nextIndex = (currentIndex + 1) % songs.length
  return songs[nextIndex]
}

// 获取上一首歌曲（支持动态列表）
export const getPrevSong = (currentSongId: string, songs: Song[] = defaultPlaylist.songs): Song | null => {
  if (songs.length === 0) return null

  const currentIndex = songs.findIndex(s => s.id === currentSongId)
  if (currentIndex === -1) return null

  const prevIndex = currentIndex === 0 ? songs.length - 1 : currentIndex - 1
  return songs[prevIndex]
}
